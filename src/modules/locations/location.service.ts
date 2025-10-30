import { mongoConnection } from "../../config/mongo.js";
import { HttpError } from "../../core/httpError.js";
import { endOfUTCDay, startOfUTCDay } from "../../utils/dates.js";
import { stringifyId, toObjectId } from "../../utils/objectId.js";
import {
  BookingSummary,
  LocationSummary,
  OutletSummary,
  ValidateLocationRequest,
  ValidateLocationResponse,
} from "./location.types.js";

const ACTIVE_BOOKING_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN"];

const normalizeOutlet = (doc: any): OutletSummary | null => {
  if (!doc) return null;
  return {
    id: stringifyId(doc._id) ?? stringifyId(doc.id) ?? "",
    name: typeof doc.name === "string" ? doc.name : doc.location_key ?? null,
    location_key: typeof doc.location_key === "string" ? doc.location_key : null,
  };
};

const normalizeLocation = (doc: any): LocationSummary | null => {
  if (!doc) return null;
  return {
    id: stringifyId(doc._id) ?? stringifyId(doc.id) ?? "",
    code: doc.code,
    type: doc.type,
    outlet_id: doc.outlet_id,
  };
};

const normalizeBooking = (doc: any): BookingSummary | null => {
  if (!doc) return null;
  return {
    id: stringifyId(doc._id) ?? stringifyId(doc.id) ?? "",
    guest_name: doc.guest_name,
    status: doc.status,
    check_in_date: doc.check_in_date,
    check_out_date: doc.check_out_date,
    booking_code: doc.booking_code,
    room_total: doc.total_amount ?? doc.room_total ?? 0,
    rooms_allocated: doc.rooms_allocated ?? [],
  };
};

export class LocationService {
  async validate(payload: ValidateLocationRequest): Promise<ValidateLocationResponse> {
    const db = mongoConnection.getDb();
    const outletsCollection = db.collection("outlets");
    const roomsCollection = db.collection("rooms_tables");
    const bookingsCollection = db.collection("bookings");

    const { code, type, outletId } = payload;

    const trimmedCode = code?.trim() ?? "";
    const trimmedType = type?.toString().trim() ?? "";
    const trimmedOutletId = outletId?.trim() ?? "";

    if (!trimmedCode && !trimmedType && !trimmedOutletId) {
      const outlets = await outletsCollection
        .find({ is_active: true }, { projection: { location_key: 1, name: 1 } })
        .toArray();
      return {
        outlet: outlets
          .map(normalizeOutlet)
          .filter((entry): entry is OutletSummary => Boolean(entry?.id)),
      };
    }

    if (!trimmedCode || !trimmedType || !trimmedOutletId) {
      return {
        valid: false,
        message: "code, type and outletId are required",
        location: null,
        outlet: null,
      };
    }

    const outletObjectId = toObjectId(trimmedOutletId);
    const outletDoc = await outletsCollection.findOne({
      is_active: true,
      $or: [
        { location_key: trimmedOutletId },
        ...(outletObjectId ? [{ _id: outletObjectId }] : []),
      ],
    });

    if (!outletDoc) {
      return {
        valid: false,
        message: "Invalid outlet",
        location: null,
        outlet: null,
      };
    }

    const resolvedOutletKey = outletDoc.location_key ?? trimmedOutletId;
    const normalizedType = trimmedType.toUpperCase();

    const locationDoc = await roomsCollection.findOne({
      code: trimmedCode,
      type: normalizedType,
      is_active: true,
      outlet_id: resolvedOutletKey,
    });

    if (!locationDoc) {
      return {
        valid: false,
        message: "Invalid room or table code",
        location: null,
        outlet: normalizeOutlet(outletDoc),
      };
    }

    let bookingPayload: BookingSummary | null = null;
    if (normalizedType === "ROOM" || normalizedType === "HOTEL_ROOM") {
      const now = new Date();
      const todayStart = startOfUTCDay(now);
      const todayEnd = endOfUTCDay(now);
      const roomIdStr = stringifyId(locationDoc._id) ?? "";
      const candidateIds = [roomIdStr, trimmedCode].filter(Boolean);

      const booking = await bookingsCollection.findOne({
        outlet_id: resolvedOutletKey,
        status: { $in: ACTIVE_BOOKING_STATUSES },
        $and: [
          {
            $or: [
              { room_id: { $in: candidateIds } },
              { room_ids: { $in: candidateIds } },
              { "rooms_allocated.room_id": { $in: candidateIds } },
            ],
          },
          {
            $or: [
              { check_in_date: { $lte: now }, check_out_date: { $gt: now } },
              {
                status: { $in: ["PENDING", "CONFIRMED"] },
                check_in_date: { $gte: todayStart, $lte: todayEnd },
              },
              { status: "CHECKED_IN" },
            ],
          },
        ],
      });

      if (booking) {
        bookingPayload = normalizeBooking(booking);
      }
    }

    return {
      valid: true,
      location: normalizeLocation(locationDoc),
      outlet: normalizeOutlet(outletDoc),
      booking: bookingPayload,
    };
  }
}

export const locationService = new LocationService();
