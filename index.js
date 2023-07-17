const express = require("express")
const cors = require("cors")
const { MongoClient, ServerApiVersion } = require('mongodb');
const { ObjectId } = require('mongodb');
require('dotenv').config()

const app = express()
const port = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uq4tjid.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const database = client.db('nir');
        const usersCollection = database.collection('users');

        // create user
        app.post('/create-user', async (req, res) => {
            const { data } = req.body;
            try {
                const result = await usersCollection.insertOne(data);
                // check schema validation
                res.json({
                    status: 200,
                    data: result
                })
            } catch (err) {
                res.json({
                    status: 500,
                    message: "Internal Server Error"
                })
            }
        })
        // get all users
        app.get('/all-users', async (req, res) => {
            try {
                const result = await usersCollection.find().toArray();
                res.json({
                    status: 200,
                    data: result
                })
            } catch (err) {
                res.json({
                    status: 500,
                    message: "Internal Server Error"
                })
            }
        })
        // get single user
        app.get('/single-user/:id', async (req, res) => {
            const { id } = req.params;
            const query = { _id: new ObjectId(id) };
            try {
                const result = await usersCollection.findOne(query);
                res.json({
                    status: 200,
                    data: result
                })
            } catch (err) {
                res.json({
                    status: 500,
                    message: "Internal Server Error"
                })
            }
        })
        // update single user all data - for admin
        app.put('/update-user/:id', async (req, res) => {
            const { id } = req.params;
            const query = { _id: new ObjectId(id) };
            const { data } = req.body;
            try {
                const getSingleUser = await usersCollection.findOne(query);
                if (!getSingleUser) {
                    return res.json({
                        status: 404,
                        message: "User not found"
                    })
                }
                console.log(getSingleUser)
                const result = await usersCollection.updateOne(query, {
                    // schema validation 
                    $set: {
                        name: data.name,
                        email: data.email,
                        password: data.password,
                        phone: data.phone,
                        isVerified: data.isVerified,
                        image: data.image,
                        location: data.location,
                        totoalPost: data.totoalPost,
                        rentSuccess: data.rentSuccess,
                    }
                });
                res.json({
                    status: 200,
                    data: result
                })
            }
            catch (err) {
                res.json({
                    status: 500,
                    message: "Internal Server Error"
                })
            }
        })
        // delete single user
        app.delete('/delete-user/:id', async (req, res) => {
            const { id } = req.params;
            const query = { _id: new ObjectId(id) };
            try {
                const result = await usersCollection.deleteOne(query);
                res.json({
                    status: 200,
                    data: result
                })
            } catch (err) {
                res.json({
                    status: 500,
                    message: "Internal Server Error"
                })
            }
        })
        // app.patch('/update-user/:id', async (req, res) => {
        //     const { id } = req.params;
        //     const data = req.body; // Assuming the data to update is sent in the request body
        //     console.log(data)
        //     try {
        //         // Check if the provided ID is a valid ObjectId
        //         if (!ObjectId.isValid(id)) {
        //             return res.status(400).json({
        //                 status: 400,
        //                 message: "Invalid user ID"
        //             });
        //         }

        //         // Build the update object based on the fields available in the request body
        //         const updateObject = {};
        //         if (data.name) updateObject.name = data.name;
        //         if (data.email) updateObject.email = data.email;
        //         if (data.password) updateObject.password = data.password;
        //         if (data.phone) updateObject.phone = data.phone;
        //         if (data.isVerified !== undefined) updateObject.isVerified = data.isVerified;
        //         if (data.image) updateObject.image = data.image;
        //         if (data.location) updateObject.location = data.location;
        //         if (data.totalPost) updateObject.totalPost = data.totalPost;
        //         if (data.rentSuccess) updateObject.rentSuccess = data.rentSuccess;
        //         console.log("Update Object:", updateObject);
        //         // Update the user data in the MongoDB collection
        //         const result = await usersCollection.updateOne(
        //             { _id: new ObjectId(id) },
        //             { $set: updateObject }
        //         );
        //         console.log(result);
        //         if (result.modifiedCount === 0) {
        //             return res.status(404).json({
        //                 status: 404,
        //                 message: "User not found"
        //             });
        //         }

        //         res.json({
        //             status: 200,
        //             message: "User updated successfully"
        //         });
        //     } catch (err) {
        //         console.error(err);
        //         res.status(500).json({
        //             status: 500,
        //             message: "Internal Server Error"
        //         });
        //     }
        // });
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Nir listening at port : ${port}`)
})