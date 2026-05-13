// const express = require('express');
import express from "express";

//--------import mongoose module to connect to MongoDB--------

import bodyParser from "body-parser";
import dotenv from "dotenv";
import { databaseConnection } from "./src/config/database.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRouter from "./src/routes/auth-routes.routes.js";
import profileRouter from "./src/routes/profile.routes.js";

// import swagger
import { setupSwagger } from "./src/config/swagger.js";
// tạo ứng dụng express
const app = express();
const port = 3000;
dotenv.config();
// --------------connect to mongodb--------------
databaseConnection();
// ---------------------------------------------
app.use(cookieParser());
app.use(express.json()); // chuyển đổi dữ liệu từ client gửi lên thành định dạng json
app.use(bodyParser.urlencoded({ extended: true })); // xử lý dữ liệu form gửi lên

app.use(
  cors({
    origin: "*", //cho phép domain này truy cập vào server
    methods: ["GET", "POST", "PUT", "DELETE"], // cho phép các phương thức này
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
app.use("/api/profile", profileRouter); // mục đích phục vụ cho riêng profile')

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`, "http://localhost:3000");
});

// mongodb+srv://thanhnqse172335_db_user:NguyenQuangThanh@cluster0.irndqwy.mongodb.net/?appName=Cluster0
// mongoDB: no sql database
// mongoose: là một thư viện giúp kết nối và tương tác với MongoDB dễ dàng hơn

//MVC: Model View Controller
//Model: quản lý dữ liệu, tương tác với database
//View: giao diện người dùng
//Controller: điều hướng luồng dữ liệu giữa Model và View
