const express = require("express")
const cors = require("cors")
const { MongoClient, ServerApiVersion } = require('mongodb');
const { ObjectId } = require('mongodb');
require('dotenv').config()
const { randomBytes } = require('crypto'); // For generating OTP
const nodemailer = require('nodemailer');


const app = express()
const port = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uq4tjid.mongodb.net/?retryWrites=true&w=majority`;
// Initialize SendGrid with your API key

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Create a nodemailer transporter with your email service configuration
const transporter = nodemailer.createTransport({
    service: 'Gmail', // Replace with your email service (e.g., Gmail, Outlook, etc.)
    auth: {
        user: process.env.NODE_MAILER_USER,
        pass: process.env.NODE_MAILER_PASS
    }
});

async function run() {
    try {
        const database = client.db('nir');
        const usersCollection = database.collection('users');
        const otpCollection = database.collection('otp');

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

        // send verification code to email
        app.post('/getVerificationCode', async (req, res) => {
            const { email } = req.body;

            // Generate a random 4-digit OTP
            const otp = Math.floor(1000 + Math.random() * 9000).toString();

            // Compose the email to send
            const mailOptions = {
                to: email, // The recipient's email address
                subject: 'OTP Verification Code',
                text: `Your OTP verification code is: ${otp}`,
            };

            try {
                // Save the generated OTP along with the user's email and a timestamp to the database
                const otpData = {
                    email: email,
                    otp: otp,
                    timestamp: new Date()
                };
                await otpCollection.insertOne(otpData);

                // Send the email using the nodemailer transporter
                await transporter.sendMail(mailOptions);
                res.json({
                    status: 200,
                    message: "OTP sent successfully",
                    // otp: otp // For testing purposes, you can send the OTP back in the response
                });
            } catch (err) {
                console.error(err);
                res.json({
                    status: 500,
                    message: "Failed to send OTP"
                });
            }
        });

        // Route to verify the user-provided OTP against the last generated OTP
        app.post('/verifyOTP', async (req, res) => {
            const { email, userOTP } = req.body;

            // Find the last OTP generated for the provided email address
            const query = { email: email };
            // Sort by timestamp in descending order to get the latest OTP
            const sort = { timestamp: -1 };
            const lastOTPData = await otpCollection.findOne(query, { sort: sort });

            if (!lastOTPData) {
                return res.json({
                    status: 404,
                    message: "No OTP found for the provided email"
                });
            }

            // Compare the user-provided OTP with the last generated OTP
            if (userOTP === lastOTPData.otp) {
                res.json({
                    status: 200,
                    message: "OTP verification successful"
                });
            } else {
                res.json({
                    status: 400,
                    message: "Invalid OTP"
                });
            }
        });

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