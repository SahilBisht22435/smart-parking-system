// // TO RUN BACKEND === node server.js// //
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");//Mongoose to connect with MongoDB
const cors = require("cors");//CORS so our frontend can call the backend.

const app = express();

//This allows frontend requests and lets backend read JSON data.
app.use(cors());
app.use(express.json());


 //This schema defines what we store in MongoDB
const ParkingSchema = new mongoose.Schema({
  parking: Array,
  vehicles: Object,
  history: Array,
  waitingQueue: Array,
  vipQueue: Array,
  undoStack: Array
});

const Parking = mongoose.model("Parking", ParkingSchema);


//This API saves the complete parking system state to MongoDB. 
// First it clears old data, then stores the latest data.
app.post("/save", async (req, res) => {
  try {
    await Parking.deleteMany({});
    await Parking.create(req.body);
    res.send("Saved");
  } catch (error) {
    console.error("Save error:", error);
    res.status(500).send("Error saving data");
  }
});

app.post("/reset", async (req, res) => {
  try {
    await Parking.deleteMany({});
    res.send("Reset done");
  } catch (error) {
    console.error("Reset error:", error);
    res.status(500).send("Reset failed");
  }
});

//This API loads saved parking data from MongoDB.
app.get("/load", async (req, res) => {
  try {
    const data = await Parking.findOne();
    res.json(data || {});
  } catch (error) {
    console.error("Load error:", error);
    res.status(500).json({});
  }
});

async function startServer() {
  try {
    console.log("Connecting to MongoDB Atlas...");

    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB Atlas connected");

    app.listen(5000, () => {
      console.log("Server running on port 5000");
    });
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
}

startServer();
