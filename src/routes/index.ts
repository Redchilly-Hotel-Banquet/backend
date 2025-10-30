import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes.js";
import { locationRouter } from "../modules/locations/location.routes.js";
import { menuRouter } from "../modules/menu/menu.routes.js";
import { publicOrderRouter, adminOrderRouter } from "../modules/orders/order.routes.js";
import { publicOutletRouter, adminOutletRouter } from "../modules/outlets/outlet.routes.js";
import { publicBookingRouter, adminBookingRouter } from "../modules/bookings/booking.routes.js";
import { publicRoomRouter, adminRoomRouter } from "../modules/rooms/room.routes.js";
import { adminCategoryRouter } from "../modules/categories/category.routes.js";
import { adminAnalyticsRouter } from "../modules/analytics/analytics.routes.js";

export const routes = Router();

routes.use("/auth", authRouter);

const publicRoutes = Router();
publicRoutes.use("/locations", locationRouter);
publicRoutes.use("/menu", menuRouter);
publicRoutes.use("/orders", publicOrderRouter);
publicRoutes.use("/outlets", publicOutletRouter);
publicRoutes.use("/rooms", publicRoomRouter);
publicRoutes.use("/bookings", publicBookingRouter);

const adminRoutes = Router();
adminRoutes.use("/orders", adminOrderRouter);
adminRoutes.use("/outlets", adminOutletRouter);
adminRoutes.use("/bookings", adminBookingRouter);
adminRoutes.use("/categories", adminCategoryRouter);
adminRoutes.use("/analytics", adminAnalyticsRouter);
adminRoutes.use("/rooms", adminRoomRouter);

routes.use("/public", publicRoutes);
routes.use("/admin", adminRoutes);
