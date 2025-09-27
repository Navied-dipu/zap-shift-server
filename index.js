import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import Stripe from "stripe";

const app = express();
const port = process.env.PORT || 5000;
dotenv.config();

const stripe = new Stripe(process.env.PAYMENT_GETWAY_KEY);

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
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const db = client.db("parcelDB");
    const usersCollectiondb = db.collection("users");
    const parcelCollectiondb = db.collection("parcels");
    const paymentCollectiondb = db.collection("payments");

    // user collection
    app.post("/users", async (req, res) => {
      const email = req.body.email;
      const existingUser = await usersCollectiondb.findOne({ email });
      if (existingUser) {
        // update profile & last login
        const updateUser = await usersCollectiondb.updateOne(
          { email }, // ✅ filter
          {
            $set: {
              lastLogin: new Date().toISOString(),
            },
          }
        );

        return res.status(200).send({
          message: "✅ User already exists, updated profile & last login",
          updated: true,
          updateUser,
        });
      }
      const user = req.body;
      const result = await usersCollectiondb.insertOne(user);
      res.send(result);
    });
    app.post("/parcels", async (req, res) => {
      try {
        const newItem = req.body;
        const result = await parcelCollectiondb.insertOne(newItem);
        res.status(201).send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to add item" });
      }
    });
    // find

    app.get("/parcels", async (req, res) => {
      try {
        const { email, role } = req.query;

        let filter = {};
        if (role !== "admin") {
          filter = email ? { sender_email: email } : {};
        }

        const parcels = await parcelCollectiondb
          .find(filter)
          .sort({ createdAt: -1 })
          .toArray();

        res.status(200).send(parcels);
      } catch (err) {
        res.status(500).send({ message: "Server error", error: err.message });
      }
    });

    app.get("/parcels/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const parcel = await parcelCollectiondb.findOne({
          _id: new ObjectId(id),
        });

        if (!parcel) {
          return res.status(404).send("❌ Parcel not found");
        }
        res.send(parcel);
      } catch (err) {
        console.error("❌ Error fetching parcel:", err.message);
        res.status(500).send("❌ Failed to fetch parcel");
      }
    });

    // Delete a parcel by id
    app.delete("/parcels/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await parcelCollectiondb.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
      }
    });

    // Create Payment Intent
    app.post("/create-payment-intent", async (req, res) => {
      try {
        const amountInCents = req.body.amountInCents; // amount in smallest unit (cents)

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents,
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });
    // get payments api
    // 1️⃣ Get all payments (sorted latest first)
    app.get("/payments", async (req, res) => {
      try {
        const email = req.query.email;
        const filter = email ? { email } : {};
        const payments = await paymentCollectiondb
          .find(filter)
          .sort({ createdAt: -1 })
          .toArray();
        res.send(payments);
      } catch (err) {
        res.status(500).send("❌ Failed to fetch payments");
      }
    });

    // 2️⃣ Mark parcel as paid & add to payments history
    app.post("/payments", async (req, res) => {
      try {
        const { parcelId, amount, transactionId, paymentMethod, email } =
          req.body;
        // 🔹 Update parcel payment_status in parcels collection
        const updateResult = await parcelCollectiondb.updateOne(
          { _id: new ObjectId(parcelId) },
          { $set: { payment_status: "paid" } }
        );

        if (updateResult.modifiedCount === 0) {
          return res.status(404).send("❌ Parcel not found or already paid");
        }

        // 🔹 Add payment history record
        const paymentRecord = {
          parcelId: new ObjectId(parcelId),
          email,
          amount,
          transactionId,
          paymentMethod,
          status: "succeeded",
          createdAt: new Date(),
          createdAtString: new Date().toISOString(),
        };

        const paymentResult = await paymentCollectiondb.insertOne(
          paymentRecord
        );

        res.send({
          paymentResult,
          message: "✅ Payment marked as paid & history recorded",
          paymentId: paymentResult.insertedId,
        });
      } catch (err) {
        console.error("❌ Error processing payment:", err.message);
        res.status(500).send("❌ Failed to process payment");
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
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
app.listen(port, () =>
  console.log(`Server running on http://localhost:${port}`)
);
