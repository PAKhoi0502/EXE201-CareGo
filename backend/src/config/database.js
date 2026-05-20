import mongoose from 'mongoose';
import dns from "dns";
dns.setServers(["1.1.1.1", "8.8.8.8"]);
import dotenv from 'dotenv';
dotenv.config();
const dbUrl = process.env.MONGODB_URL;

export const databaseConnection = async () => {
    try {
        await mongoose.connect(dbUrl, {
            dbName: process.env.MONGODB_DB_NAME || "carego",
        });
        console.log('Connected to MongoDB database:', mongoose.connection.name);
    } catch (error) {
        console.log('Error connecting to MongoDB:', error);
        process.exit(1);
    }
};



// // --------------connect to mongodb--------------
// // đây là phương thức promise nên ta dùng .then() và .catch() để xử lý
// mongoose.connect('mongodb+srv://thanhnqse172335_db_user:NguyenQuangThanh@cluster0.mgqjgor.mongodb.net/?appName=Cluster0')
// .then(()=>{
//   console.log('Connected to MongoDB')
// })
// .catch((error)=>{
//   console.log('Error connecting to MongoDB:', error)
// })
// // ---------------------------------------------
