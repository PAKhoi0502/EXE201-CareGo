// const express = require('express');
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

//--------import mongoose module to connect to MongoDB--------

import bodyParser from "body-parser";
import dotenv from "dotenv";
import { databaseConnection } from "./src/config/database.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRouter from "./src/routes/auth-routes.routes.js";
import adminRouter from "./src/routes/admin.routes.js";
import bookingRouter from "./src/routes/booking.routes.js";
import bookingChatRouter from "./src/routes/booking-chat.routes.js";
import companionRouter from "./src/routes/companion.routes.js";
import elderRouter from "./src/routes/elder.routes.js";
import paymentRouter from "./src/routes/payment.routes.js";
import serviceRouter from "./src/routes/service.routes.js";
import uploadRouter from "./src/routes/upload.routes.js";
import withdrawalRouter from "./src/routes/withdrawal.routes.js";
import supportRouter from "./src/routes/support.routes.js";
import { setupLocationSocket } from "./src/socket/location.socket.js";
import { setupSupportSocket } from "./src/socket/support.socket.js";
import { setupBookingChatSocket } from "./src/socket/booking-chat.socket.js";
import { setupSocketAuthentication } from "./src/socket/auth.socket.js";

// import swagger
import { setupSwagger } from "./src/config/swagger.js";
// tạo ứng dụng express
const app = express();
const server = createServer(app);
const port = 3000;
dotenv.config();
// --------------connect to mongodb--------------
await databaseConnection();
// ---------------------------------------------
app.use(cookieParser());
app.use(express.json({ limit: "8mb" })); // chuyển đổi dữ liệu từ client gửi lên thành định dạng json
app.use(bodyParser.urlencoded({ extended: true, limit: "8mb" })); // xử lý dữ liệu form gửi lên

app.use(
  cors({
    origin: "*", //cho phép domain này truy cập vào server
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"], // cho phép các phương thức này
    allowedHeaders: "*", //cho phép các heder này gửi lên server
    credentials: true, //cho phép gửi cookie
  }),
);

//thiết lập swagger
setupSwagger(app);

// trong express chứa các phương thức để xây dựng web server như: get, post, put, delete, ...
// req: request (yêu cầu từ client gửi lên server)
// res: response (phản hồi từ server gửi về client)

app.use("/api/auth", authRouter); // mục dích phục vụ cho riêng authentication
app.use("/api/services", serviceRouter);
app.use("/api/companions", companionRouter);
app.use("/api/elders", elderRouter);
app.use("/api/bookings", bookingRouter);
app.use("/api/booking-chat", bookingChatRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/admin", adminRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/withdrawals", withdrawalRouter);
app.use("/api/support", supportRouter);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  },
});

setupSocketAuthentication(io);
setupLocationSocket(io);
setupSupportSocket(io);
setupBookingChatSocket(io);

server.listen(port, () => {
  console.log(`Example app listening on port ${port}`, "http://localhost:3000");
});

// mongodb+srv://thanhnqse172335_db_user:NguyenQuangThanh@cluster0.irndqwy.mongodb.net/?appName=Cluster0
// mongoDB: no sql database
// mongoose: là một thư viện giúp kết nối và tương tác với MongoDB dễ dàng hơn

//MVC: Model View Controller
//Model: quản lý dữ liệu, tương tác với database
//View: giao diện người dùng
//Controller: điều hướng luồng dữ liệu giữa Model và View
