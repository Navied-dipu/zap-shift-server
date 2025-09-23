import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// === Middleware ===
// Enable CORS for all routes
app.use(cors());

// Parse JSON
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2z2tafq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const  parcelCollectiondb=client.db('parcelDB').collection('parcels')

    app.get('/parcels', async (req, res)=>{
        const parcels= await parcelCollectiondb.find().toArray()
        res.send(parcels)
    })

    app.post("/parcels", async (req, res) => {
         try {
          const newItem = req.body;
             const result = await parcelCollectiondb.insertOne(newItem);
             res.status(201).send(result)
           }
            catch (err) {
           console.error(err);
          res.status(500).send({ error: "Failed to add item" });
         }
    });
    // find

        // Get parcels for a specific user by email
      app.get("/parcels", async (req, res) => {
      try {
       const email = req.query.email; // optional query parameter
        const filter = email ? { sender_email: email } : {}; // filter by email if exists

        const parcels = await parcelCollectiondb
       .find(filter)
        .sort({ createdAt: -1 }) // latest first
        .toArray();

       res.status(200).send(parcels);
           } catch (err) {
        res.status(500).send({ message: "Server error", error: err.message });
        }
      });
      // delete
      // Delete a parcel by id
      app.delete("/parcels/:id", async (req, res) => {
        try {
        const id = req.params.id;
       const result = await parcelCollectiondb.deleteOne({ _id: new ObjectId(id) });
       res.send(result);
       } catch (error) {
       res.status(500).json({ message: "Server error", error: error.message });
       }
      });


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



// Routes
app.get("/", (req, res) => {
  res.send("Server with CORS is running 🚀");
});

app.post("/data", (req, res) => {
  res.json({ message: "You sent:", data: req.body });
});

// Start server
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
