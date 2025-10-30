import { mongoConnection } from "../../config/mongo.js";
import { HttpError } from "../../core/httpError.js";
import { AuthenticatedUser } from "../../middleware/authenticate.js";
import { normalizeDocument } from "../../utils/normalizers.js";
import { stringifyId, toObjectId } from "../../utils/objectId.js";

type FlexibleId = string | import("mongodb").ObjectId;

type BookingRecord = Record<string, unknown> & {
  _id: FlexibleId;
  room_id?: FlexibleId;
  room_ids?: FlexibleId[];
  rooms_allocated?: Array<Record<string, unknown>>;
  outlet_id?: FlexibleId;
  checkin_details?: Record<string, unknown>;
  booking_code?: string;
};

type RoomRecord = Record<string, unknown> & {
  _id: FlexibleId;
};

type OutletRecord = Record<string, unknown> & {
  _id: FlexibleId;
};

type ManageBookingsRequest = {
  action: "list" | "update_status" | "update_amount";
  id?: string;
  status?: string;
  totalAmount?: number;
};

type CheckinRequest = {
  action: "admin-fetch" | "submit";
  bookingId?: string;
  bookingCode?: string;
  checkinData?: Record<string, unknown>;
  markAsCheckedIn?: boolean;
};

type BillingRequest = {
  bookingId?: string;
  action?: "checkout";
};

type OrderDocument = {
  _id: string | import("mongodb").ObjectId;
  total?: number;
  subtotal?: number;
  status?: string;
  created_at?: string | Date;
  booking_id?: string | import("mongodb").ObjectId;
};

const ORDER_STATUSES_TO_INCLUDE = new Set([
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "DELIVERED",
  "ORDER_FINISHED",
]);

const ACTIVE_BOOKING_STATUSES = new Set(["PENDING", "CONFIRMED", "CHECKED_IN"]);
const MAX_DATA_URL_LENGTH = 10_000_000;

const toNumber = (value: unknown, fallback = 0): number => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const normaliseString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const normaliseId = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "object" && value) {
    const maybe = (value as { toString?: () => string }).toString?.();
    if (maybe && maybe !== "[object Object]") {
      return maybe;
    }
    const oid = (value as { $oid?: string }).$oid;
    if (typeof oid === "string") return oid;
  }
  return undefined;
};

const sanitiseDataUrl = (value: unknown) => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("data:")) return null;
  if (trimmed.length > MAX_DATA_URL_LENGTH) {
    throw new HttpError(400, "Uploaded file is too large. Please keep uploads under 7MB.");
  }
  return trimmed;
};

const ensureObjectId = (value: unknown, message: string) => {
  const resolved = toObjectId(value);
  if (!resolved) {
    throw new HttpError(400, message);
  }
  return resolved;
};

const resolveDocumentId = (value: unknown, message: string): FlexibleId => {
  const objectId = toObjectId(value);
  if (objectId) return objectId;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length) return trimmed;
  }
  throw new HttpError(400, message);
};

const computeAvailableRooms = async (
  db: import("mongodb").Db,
  booking: BookingRecord,
) => {
  const roomsCollection = db.collection<RoomRecord>("rooms_tables");
  const bookingsCollection = db.collection<BookingRecord>("bookings");

  const outletId = booking?.outlet_id;
  const checkInDate = booking?.check_in_date ? new Date(booking.check_in_date as string) : null;
  const checkOutDate = booking?.check_out_date ? new Date(booking.check_out_date as string) : null;

  if (
    !outletId ||
    !checkInDate ||
    !checkOutDate ||
    Number.isNaN(checkInDate.getTime()) ||
    Number.isNaN(checkOutDate.getTime())
  ) {
    return [] as Array<{
      id: string;
      code: string;
      type?: string;
      room_type?: string;
      occupancy?: number;
      price_per_night?: number;
      level?: string;
      isAssignedToBooking: boolean;
      isOccupiedByAnother: boolean;
    }>;
  }

  const allRooms = await roomsCollection
    .find({
      outlet_id: outletId,
      is_active: { $ne: false },
      type: { $in: ["ROOM", "room", "HOTEL_ROOM", "hotel_room"] },
    })
    .toArray();

  const otherBookings = await bookingsCollection
    .find({
      outlet_id: outletId,
      status: { $in: Array.from(ACTIVE_BOOKING_STATUSES) },
      _id: { $ne: booking._id as any },
    })
    .toArray();

  const overlappingRoomIds = new Set<string>();
  otherBookings.forEach((candidate) => {
    const otherCheckIn = candidate?.check_in_date
      ? new Date(candidate.check_in_date as string | number | Date)
      : null;
    const otherCheckOut = candidate?.check_out_date
      ? new Date(candidate.check_out_date as string | number | Date)
      : null;
    if (
      !otherCheckIn ||
      !otherCheckOut ||
      Number.isNaN(otherCheckIn.getTime()) ||
      Number.isNaN(otherCheckOut.getTime())
    ) {
      return;
    }

    const overlaps = otherCheckIn <= checkOutDate && otherCheckOut >= checkInDate;
    if (!overlaps) return;

    const recordId = (value: unknown) => {
      const id = normaliseId(value);
      if (id) overlappingRoomIds.add(id);
    };

    recordId(candidate.room_id);
    if (Array.isArray(candidate.room_ids)) candidate.room_ids.forEach(recordId);
    if (Array.isArray(candidate.rooms_allocated)) {
      candidate.rooms_allocated.forEach((entry: any) => recordId(entry?.room_id ?? entry?._id));
    }
    const assigned = candidate.checkin_details as any;
    if (assigned) {
      if (Array.isArray(assigned.assigned_rooms)) {
        assigned.assigned_rooms.forEach((entry: any) =>
          recordId(entry?.id ?? entry?._id ?? entry?.room_id),
        );
      }
      if (assigned.assigned_room) {
        recordId(assigned.assigned_room?.id ?? assigned.assigned_room?._id ?? assigned.assigned_room?.room_id);
      }
    }
  });

  const bookingRoomIds = new Set<string>();
  const recordBookingRoom = (value: unknown) => {
    const id = normaliseId(value);
    if (id) bookingRoomIds.add(id);
  };
  recordBookingRoom(booking.room_id);
  if (Array.isArray(booking.room_ids)) booking.room_ids.forEach(recordBookingRoom);
  if (Array.isArray(booking.rooms_allocated)) {
    booking.rooms_allocated.forEach((entry: any) => recordBookingRoom(entry?.room_id ?? entry?._id));
  }
  const assigned = booking.checkin_details as any;
  if (assigned) {
    if (Array.isArray(assigned.assigned_rooms)) {
      assigned.assigned_rooms.forEach((entry: any) =>
        recordBookingRoom(entry?.id ?? entry?._id ?? entry?.room_id),
      );
    }
    if (assigned.assigned_room) {
      recordBookingRoom(assigned.assigned_room?.id ?? assigned.assigned_room?._id ?? assigned.assigned_room?.room_id);
    }
  }

  const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
  return allRooms
    .map((room: any) => {
      const id = normaliseId(room?._id);
      if (!id) return null;
      return {
        id,
        code: String(room.code ?? ""),
        type: room.type ? String(room.type) : undefined,
        room_type: room.room_type ? String(room.room_type) : undefined,
        occupancy: room.occupancy != null ? Number(room.occupancy) : undefined,
        price_per_night: room.price_per_night != null ? Number(room.price_per_night) : undefined,
        level: room.level ? String(room.level) : undefined,
        isAssignedToBooking: bookingRoomIds.has(id),
        isOccupiedByAnother: overlappingRoomIds.has(id) && !bookingRoomIds.has(id),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((a, b) => collator.compare(a.code ?? "", b.code ?? ""));
};

const serialiseBookingDetailed = (doc: Record<string, unknown>) => {
  const clone = { ...doc } as Record<string, unknown>;
  const id = stringifyId(clone._id) ?? stringifyId(clone.id);
  if (id) {
    clone.id = id;
    clone._id = id;
  } else {
    delete clone._id;
  }

  if (clone.room_id) {
    const roomId = stringifyId(clone.room_id);
    clone.room_id = roomId ?? clone.room_id;
  }

  if (Array.isArray(clone.room_ids)) {
    clone.room_ids = clone.room_ids
      .map((value: unknown) => stringifyId(value) ?? normaliseId(value))
      .filter((value): value is string => Boolean(value));
  }

  if (Array.isArray(clone.rooms_allocated)) {
    clone.rooms_allocated = clone.rooms_allocated.map((entry: any) => {
      if (!entry) return entry;
      const { _id: entryId, room_id: entryRoomId, ...rest } = entry;
      const mapped: Record<string, unknown> = { ...rest };
      const resolvedId = stringifyId(entryId) ?? normaliseId(entryId);
      if (resolvedId) mapped.id = resolvedId;
      const resolvedRoomId = stringifyId(entryRoomId) ?? normaliseId(entryRoomId);
      if (resolvedRoomId) mapped.room_id = resolvedRoomId;
      return mapped;
    });
  }

  return clone;
};
const serialiseEmbedded = (doc: any) => {
  if (!doc) return null;
  const normalised = normalizeDocument(doc);
  if (!normalised) return null;
  return { ...normalised, id: normalised.id ?? stringifyId(doc?._id) ?? "" };
};

const normaliseBooking = (doc: any) => {
  if (!doc) return null;
  const { guest_token, ...rest } = doc;
  const normalised = normalizeDocument(rest);
  if (!normalised) return null;
  const primaryRoomId = stringifyId(rest.room_id);
  if (primaryRoomId) normalised.room_id = primaryRoomId;
  if (Array.isArray(normalised.room_ids)) {
    normalised.room_ids = normalised.room_ids.map((rid: any) => stringifyId(rid) ?? String(rid ?? ""));
  }
  return normalised;
};

export class BookingService {
  async manage(request: ManageBookingsRequest, user: AuthenticatedUser) {
    if (!user.roles.includes("admin") && !user.roles.includes("rooms")) {
      throw new HttpError(403, "Insufficient permissions to manage bookings");
    }

    const db = mongoConnection.getDb();
    const bookingsCollection = db.collection<BookingRecord>("bookings");
    const roomsCollection = db.collection<RoomRecord>("rooms_tables");
    const outletsCollection = db.collection<OutletRecord>("outlets");

    switch (request.action) {
      case "list": {
        const filter: Record<string, unknown> = {};
        if (!user.outlets.includes("all")) {
          filter.outlet_id = { $in: user.outlets };
        }
        const bookings = await bookingsCollection.find(filter).sort({ created_at: -1 }).toArray();

        const enriched = [] as any[];
        for (const booking of bookings) {
          const roomId = booking.room_id;
          const outletId = booking.outlet_id;

          const room = roomId
            ? await roomsCollection.findOne({
                _id: resolveDocumentId(roomId, "Invalid room id"),
              })
            : null;

          const outlet = outletId
            ? await outletsCollection.findOne({
                _id: resolveDocumentId(outletId, "Invalid outlet id"),
              })
            : null;

          const normalised = normaliseBooking(booking);
          enriched.push({
            ...normalised,
            rooms_tables: serialiseEmbedded(room),
            outlets: serialiseEmbedded(outlet),
          });
        }

        return { bookings: enriched };
      }

      case "update_status": {
        if (!request.id || !request.status) {
          throw new HttpError(400, "id and status are required");
        }

        const patch: Record<string, unknown> = {
          status: request.status,
          updated_at: new Date(),
        };
        if (request.status === "CHECKED_IN") patch.checked_in_at = new Date();
        if (request.status === "CHECKED_OUT") patch.checked_out_at = new Date();

        const filter = { _id: resolveDocumentId(request.id, "Invalid booking id") };
        await bookingsCollection.updateOne(filter, { $set: patch });

        const updated = await bookingsCollection.findOne(filter);
        if (!updated) {
          throw new HttpError(404, "Booking not found");
        }

        const room = updated.room_id
          ? await roomsCollection.findOne({
              _id: resolveDocumentId(updated.room_id, "Invalid room id"),
            })
          : null;
        const outlet = updated.outlet_id
          ? await outletsCollection.findOne({
              _id: resolveDocumentId(updated.outlet_id, "Invalid outlet id"),
            })
          : null;

        const normalised = normaliseBooking(updated);

        return {
          booking: {
            ...normalised,
            rooms_tables: serialiseEmbedded(room),
            outlets: serialiseEmbedded(outlet),
          },
        };
      }

      case "update_amount": {
        if (!request.id) {
          throw new HttpError(400, "id is required");
        }

        const totalAmount = Number(request.totalAmount ?? NaN);
        if (!Number.isFinite(totalAmount) || totalAmount < 0) {
          throw new HttpError(400, "totalAmount must be a positive number");
        }

        const filter = { _id: resolveDocumentId(request.id, "Invalid booking id") };
        const patch: Record<string, unknown> = {
          total_amount: Number(totalAmount.toFixed(2)),
          room_total: Number(totalAmount.toFixed(2)),
          updated_at: new Date(),
        };

        const result = await bookingsCollection.updateOne(filter, { $set: patch });
        if (!result.matchedCount) {
          throw new HttpError(404, "Booking not found");
        }

        const updated = await bookingsCollection.findOne(filter);
        if (!updated) {
          throw new HttpError(404, "Booking not found");
        }

        const room = updated.room_id
          ? await roomsCollection.findOne({
              _id: resolveDocumentId(updated.room_id, "Invalid room id"),
            })
          : null;
        const outlet = updated.outlet_id
          ? await outletsCollection.findOne({
              _id: resolveDocumentId(updated.outlet_id, "Invalid outlet id"),
            })
          : null;

        const normalised = normaliseBooking(updated);

        return {
          booking: {
            ...normalised,
            rooms_tables: serialiseEmbedded(room),
            outlets: serialiseEmbedded(outlet),
          },
        };
      }

      default:
        throw new HttpError(400, "Invalid action");
    }
  }

  async checkin(request: CheckinRequest, user: AuthenticatedUser) {
    if (!user.roles.includes("admin") && !user.roles.includes("rooms")) {
      throw new HttpError(403, "Insufficient permissions to manage check-ins");
    }

    const db = mongoConnection.getDb();
    const bookingsCollection = db.collection<BookingRecord>("bookings");
    const roomsCollection = db.collection<RoomRecord>("rooms_tables");

    const action = request.action;
    if (action === "admin-fetch") {
      const bookingId = request.bookingId;
      if (!bookingId) {
        throw new HttpError(400, "bookingId is required");
      }

      const bookingObjectId = ensureObjectId(bookingId, "Invalid booking id");

      const booking = await bookingsCollection.findOne({
        _id: bookingObjectId,
      });

      if (!booking) {
        throw new HttpError(404, "Booking not found");
      }

      const availableRooms = await computeAvailableRooms(db, booking);

      return {
        booking: serialiseBookingDetailed(booking),
        checkinDetails: booking.checkin_details ?? null,
        availableRooms,
      };
    }

    if (action === "submit") {
      const bookingIdRaw = request.bookingId;
      const bookingCode = normaliseString(request.bookingCode).toUpperCase();
      const checkinData = (request.checkinData ?? {}) as Record<string, unknown>;
      const markAsCheckedIn = Boolean(request.markAsCheckedIn);

      if (!bookingIdRaw || !bookingCode) {
        throw new HttpError(400, "bookingId and bookingCode are required");
      }

      const bookingObjectId = ensureObjectId(bookingIdRaw, "Invalid booking id");

      const bookingFilter: import("mongodb").Filter<BookingRecord> = {
        _id: bookingObjectId,
        booking_code: bookingCode,
      };

      const booking = await bookingsCollection.findOne(bookingFilter);
      if (!booking) {
        throw new HttpError(404, "Unable to locate the booking. Please refresh and try again.");
      }

      const previousDetails = (booking.checkin_details ?? {}) as Record<string, any>;
      const previousGuests = Array.isArray(previousDetails.guests) ? previousDetails.guests : [];
      const incomingGuests = Array.isArray(checkinData.guests) ? checkinData.guests : [];

      if (!incomingGuests.length) {
        throw new HttpError(400, "At least one guest is required for check-in.");
      }

      const sanitisedGuests = incomingGuests.map((guest: any, index: number) => {
        const existingGuest = previousGuests[index] ?? null;
        const fullName = normaliseString(guest?.fullName ?? guest?.name);
        const documentType = normaliseString(guest?.documentType ?? guest?.idType);
        const documentNumber = normaliseString(guest?.documentNumber ?? guest?.idNumber);

        if (!fullName) {
          throw new HttpError(400, `Guest ${index + 1}: name is required.`);
        }
        if (!documentType) {
          throw new HttpError(400, `Guest ${index + 1}: document type is required.`);
        }
        if (!documentNumber) {
          throw new HttpError(400, `Guest ${index + 1}: document number is required.`);
        }

        const incomingImage = sanitiseDataUrl(
          guest?.documentImageDataUrl ?? guest?.documentImage ?? guest?.document_image?.data_url,
        );

        const imagePayload = incomingImage
          ? {
              data_url: incomingImage,
              file_name: normaliseString(guest?.documentImageName ?? guest?.document_image?.file_name),
              mime_type: normaliseString(guest?.documentImageType ?? guest?.document_image?.mime_type),
              uploaded_at: new Date().toISOString(),
            }
          : existingGuest?.document_image ?? null;

        if (!imagePayload) {
          throw new HttpError(400, `Guest ${index + 1}: identity document image is required.`);
        }

        const incomingSignature = sanitiseDataUrl(
          guest?.signatureDataUrl ?? guest?.signature_image?.data_url,
        );
        const signaturePayload = incomingSignature
          ? {
              data_url: incomingSignature,
              file_name: normaliseString(guest?.signatureFileName ?? guest?.signature_image?.file_name),
              mime_type: normaliseString(guest?.signatureFileType ?? guest?.signature_image?.mime_type),
              uploaded_at: new Date().toISOString(),
            }
          : existingGuest?.signature_image ?? null;

        return {
          full_name: fullName,
          document_type: documentType,
          document_number: documentNumber,
          document_image: imagePayload,
          signature_image: signaturePayload,
        };
      });

      const expectedArrivalRaw = normaliseString(checkinData.expectedArrivalTime);
      const needsAssistance = Boolean(checkinData.needsSpecialAssistance);
      const specialAssistance = needsAssistance
        ? normaliseString(checkinData.specialAssistanceDetails)
        : "";
      const otherRequests = normaliseString(checkinData.otherRequests);

      let assignedRooms: Array<{
        id: string;
        code?: string | null;
        type?: string | null;
        room_type?: string | null;
        assigned_at?: string | null;
      }> = [];

      const availabilitySnapshot = await computeAvailableRooms(db, booking);

      const assignedRoomIdsInput = Array.isArray(checkinData.assignedRoomIds)
        ? checkinData.assignedRoomIds
        : checkinData.assignedRoomId
        ? [checkinData.assignedRoomId]
        : null;

      const nowIso = new Date().toISOString();

      if (assignedRoomIdsInput !== null) {
        const normalisedIds = assignedRoomIdsInput
          .map((value: unknown) => normaliseId(value))
          .filter((value): value is string => Boolean(value));

        assignedRooms = await Promise.all(
          normalisedIds.map(async (roomId) => {
            const snapshotRoom = availabilitySnapshot.find((room) => room.id === roomId);
            if (snapshotRoom) {
              if (snapshotRoom.isOccupiedByAnother && !snapshotRoom.isAssignedToBooking) {
                throw new HttpError(400, "One of the selected rooms is no longer available. Please refresh.");
              }
              const snapshotType = snapshotRoom.room_type ?? snapshotRoom.type ?? null;
              return {
                id: roomId,
                code: snapshotRoom.code ?? null,
                type: snapshotType,
                room_type: snapshotType,
                assigned_at: nowIso,
              };
            }

            const raw = await roomsCollection.findOne({
              _id: ensureObjectId(roomId, "Invalid room id"),
            });
            if (!raw) {
              throw new HttpError(400, "Selected room could not be found. Please refresh the page.");
            }
            const fallbackType = normaliseString(raw.room_type ?? raw.type) || null;
            return {
              id: roomId,
              code: normaliseString(raw.code) || null,
              type: fallbackType,
              room_type: fallbackType,
              assigned_at: nowIso,
            };
          }),
        );
      } else {
        const previousAssigned = Array.isArray(previousDetails.assigned_rooms)
          ? previousDetails.assigned_rooms
          : [];
        assignedRooms = previousAssigned.map((room: any) => ({
          id: normaliseId(room?.id ?? room?.room_id) ?? "",
          code: room?.code ?? null,
          type: room?.type ?? room?.room_type ?? null,
          room_type: room?.room_type ?? room?.type ?? null,
          assigned_at: room?.assigned_at ?? null,
        })).filter((room) => room.id);
      }

      if (markAsCheckedIn && assignedRooms.length === 0) {
        throw new HttpError(400, "Assign at least one room before marking the booking as checked in.");
      }

      const signatureRaw = sanitiseDataUrl(
        checkinData.digitalSignature ?? checkinData.signatureDataUrl,
      );
      const signaturePayload = signatureRaw
        ? {
            data_url: signatureRaw,
            file_name: normaliseString(checkinData.digitalSignatureName),
            mime_type: normaliseString(checkinData.digitalSignatureType),
            uploaded_at: nowIso,
          }
        : (previousDetails.signature as Record<string, unknown>) ?? null;

      const previousStatus = typeof previousDetails.status === "string" ? previousDetails.status : null;
      const derivedStatus =
        markAsCheckedIn
          ? "COMPLETED"
          : previousStatus && previousStatus.length > 0
          ? previousStatus
          : "IN_PROGRESS";

      const nextCheckinDetails: Record<string, unknown> = {
        status: derivedStatus,
        submitted_at: previousDetails.submitted_at ?? nowIso,
        last_updated_at: nowIso,
        expected_arrival_time: expectedArrivalRaw || null,
        needs_special_assistance: needsAssistance,
        special_assistance_details: needsAssistance ? specialAssistance || null : null,
        other_requests: otherRequests || null,
        guests: sanitisedGuests,
        signature: signaturePayload,
      };

      if (assignedRooms.length > 0) {
        nextCheckinDetails.assigned_rooms = assignedRooms;
        nextCheckinDetails.assigned_room = assignedRooms[0];
      } else {
        nextCheckinDetails.assigned_rooms = [];
        nextCheckinDetails.assigned_room = null;
      }

      const existingPricingLines = Array.isArray(booking.rooms_allocated)
        ? booking.rooms_allocated
        : [];
      let nextRoomsAllocated: any[] | null = null;

      const updateDoc: Record<string, unknown> = {
        checkin_details: nextCheckinDetails,
        updated_at: new Date(nowIso),
      };

      if (assignedRooms.length > 0) {
        updateDoc.room_id = assignedRooms[0].id;

        const mergedRoomIds = new Set<string>();
        assignedRooms.forEach((room) => {
          if (room.id) mergedRoomIds.add(room.id);
        });
        const collect = (val: unknown) => {
          const id = normaliseId(val);
          if (id) mergedRoomIds.add(id);
        };
        if (Array.isArray(booking.room_ids)) booking.room_ids.forEach(collect);
        collect(booking.room_id);
        if (mergedRoomIds.size) updateDoc.room_ids = Array.from(mergedRoomIds);

        const mergedLines: any[] = [];
        const loopMax = Math.max(existingPricingLines.length, assignedRooms.length);
        for (let index = 0; index < loopMax; index += 1) {
          const source = existingPricingLines[index] ?? {};
          const assignedRoom = assignedRooms[index] ?? null;
          if (assignedRoom) {
            const resolvedType = assignedRoom.type ?? source.type ?? source.room_type ?? null;
            mergedLines.push({
              ...source,
              room_id: assignedRoom.id,
              code: assignedRoom.code ?? source.code ?? null,
              type: resolvedType ?? source.type ?? null,
              room_type: resolvedType ?? source.room_type ?? source.type ?? null,
              assigned_at: assignedRoom.assigned_at ?? source.assigned_at ?? nowIso,
            });
          } else {
            mergedLines.push({
              ...source,
              room_id: null,
              code: source.code ?? null,
              type: source.type ?? source.room_type ?? null,
              room_type: source.room_type ?? source.type ?? null,
              assigned_at: null,
            });
          }
        }
        nextRoomsAllocated = mergedLines;
      } else {
        updateDoc.room_id = null;
        updateDoc.room_ids = [];
        if (existingPricingLines.length > 0) {
          nextRoomsAllocated = existingPricingLines.map((line: any) => ({
            ...line,
            room_id: null,
            assigned_at: null,
          }));
        }
      }

      if (markAsCheckedIn) {
        updateDoc.status = "CHECKED_IN";
        updateDoc.checked_in_at = new Date(nowIso);
      }

      if (nextRoomsAllocated) {
        updateDoc.rooms_allocated = nextRoomsAllocated;
      }

      await bookingsCollection.updateOne(bookingFilter, { $set: updateDoc });

      const updatedBooking = await bookingsCollection.findOne(bookingFilter);
      const refreshedAvailability = await computeAvailableRooms(
        db,
        updatedBooking ?? booking,
      );

      const responseBooking = serialiseBookingDetailed(updatedBooking ?? booking);
      const responseDetails = (updatedBooking ?? booking)?.checkin_details ?? nextCheckinDetails;

      return {
        booking: responseBooking,
        checkinDetails: responseDetails,
        availableRooms: refreshedAvailability,
      };
    }

    throw new HttpError(400, "Invalid action");
  }

  async billing(request: BillingRequest, user: AuthenticatedUser) {
    if (!user.roles.includes("admin") && !user.roles.includes("rooms")) {
      throw new HttpError(403, "Insufficient permissions to view billing");
    }

    const bookingIdRaw = request.bookingId;
    if (!bookingIdRaw) {
      throw new HttpError(400, "bookingId is required");
    }

    const db = mongoConnection.getDb();
    const bookingsCollection = db.collection<BookingRecord>("bookings");
    const roomsCollection = db.collection<RoomRecord>("rooms_tables");
    const outletsCollection = db.collection<OutletRecord>("outlets");
    const ordersCollection = db.collection<OrderDocument>("orders");

    const bookingObjectId = ensureObjectId(bookingIdRaw, "Invalid booking id");
    const bookingFilter: import("mongodb").Filter<BookingRecord> = { _id: bookingObjectId };

    const booking = await bookingsCollection.findOne(bookingFilter);
    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    const room = booking.room_id
      ? await roomsCollection.findOne({
          _id: resolveDocumentId(booking.room_id, "Invalid room id"),
        })
      : null;
    const outlet = booking.outlet_id
      ? await outletsCollection.findOne({
          _id: resolveDocumentId(booking.outlet_id, "Invalid outlet id"),
        })
      : null;

    const bookingIdString = stringifyId(booking._id) ?? booking._id;
    const bookingIdentifiers: Array<string | import("mongodb").ObjectId> = [];
    if (bookingIdString) bookingIdentifiers.push(String(bookingIdString));
    const bookingObj = toObjectId(bookingIdString);
    if (bookingObj) bookingIdentifiers.push(bookingObj);

    const orders = await ordersCollection
      .find({ booking_id: { $in: bookingIdentifiers } } as Record<string, unknown>)
      .sort({ created_at: -1 })
      .toArray();

    const filteredOrders = orders.filter((order) =>
      ORDER_STATUSES_TO_INCLUDE.has(order.status ?? ""),
    );

    const foodTotal = filteredOrders.reduce((sum, order) => {
      const orderTotal = toNumber(order.total, toNumber(order.subtotal));
      return sum + orderTotal;
    }, 0);

    const checkIn = booking.check_in_date
      ? new Date(booking.check_in_date as string | number | Date)
      : null;
    const checkOut = booking.check_out_date
      ? new Date(booking.check_out_date as string | number | Date)
      : null;
    let nights = 1;
    if (
      checkIn &&
      checkOut &&
      !Number.isNaN(checkIn.getTime()) &&
      !Number.isNaN(checkOut.getTime())
    ) {
      const diff = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      nights = Math.max(diff, 1);
    }

    const allocatedRoomTotal = Array.isArray(booking.rooms_allocated)
      ? booking.rooms_allocated.reduce((sum: number, line: any) => {
          const lineTotal =
            toNumber(line.total) ||
            toNumber(line.effective_rate) *
              toNumber(line?.perNight?.length ?? booking.nights ?? 1, 1);
          return sum + lineTotal;
        }, 0)
      : 0;

    const storedRoomPortion =
      toNumber(booking.folio_total) - toNumber(booking.food_total);
    let roomTotal =
      allocatedRoomTotal > 0
        ? allocatedRoomTotal
        : storedRoomPortion > 0
        ? storedRoomPortion
        : toNumber(booking.total_amount);

    if (roomTotal <= 0) {
      const nightlyRate = toNumber(
        booking.room_rate ?? booking.rate_per_night ?? room?.price_per_night,
      );
      if (nightlyRate > 0) {
        roomTotal = nightlyRate * nights;
      }
    }
    if (roomTotal <= 0 && room?.price_per_night) {
      roomTotal = toNumber(room.price_per_night) * nights;
    }
    if (roomTotal < 0) roomTotal = 0;

    const grandTotal = roomTotal + foodTotal;

    if (request.action === "checkout") {
      await bookingsCollection.updateOne(bookingFilter, {
        $set: {
          status: "CHECKED_OUT",
          checked_out_at: new Date(),
          food_total: foodTotal,
          folio_total: grandTotal,
          updated_at: new Date(),
        },
      });
      booking.status = "CHECKED_OUT";
      booking.checked_out_at = new Date();
      booking.food_total = foodTotal;
      booking.folio_total = grandTotal;
      booking.updated_at = new Date();
    }

    const serialiseOrder = (order: OrderDocument) => {
      const { _id, ...rest } = order;
      const id = typeof _id === "string" ? _id : _id?.toString?.();
      return { id, ...rest };
    };

    const normalisedBooking = normaliseBooking(booking);

    return {
      booking: {
        ...normalisedBooking,
        rooms_tables: serialiseEmbedded(room),
        outlets: serialiseEmbedded(outlet),
      },
      foodTotal,
      roomTotal,
      grandTotal,
      orders: filteredOrders.map(serialiseOrder),
    };
  }
}

export const bookingService = new BookingService();
