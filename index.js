const express = require("express")
const cors = require("cors")
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
const { ObjectId } = require('mongodb');
require('dotenv').config()
const nodemailer = require('nodemailer');


const app = express()
const port = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(express.json())
// Middleware to verify JWT in API requests
function verifyJWT(req, res, next) {
    const token = req.header('Authorization');

    if (!token) {
        return res.status(401).json({ status: 401, message: 'Authorization token missing' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ status: 403, message: 'Invalid or expired JWT token' });
    }
}


// Generate JWT token function
function generateToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }); // Set the expiration time as desired
}

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
        const postsCollection = database.collection('posts');


        // create user
        app.post('/register', async (req, res) => {
            const { data } = req.body;
            try {
                const result = await usersCollection.insertOne(data);
                // Generate and send JWT token in the response
                const token = generateToken({ userId: result.insertedId }); // Include any additional data you want in the payload
                res.json({
                    status: 200,
                    data: result,
                    jwt: token
                });
            } catch (err) {
                res.json({
                    status: 500,
                    message: "Internal Server Error"
                })
            }
        })
        // login user - check isVarified true or false
        app.post('/login', async (req, res) => {
            const { email, password } = req.body;
            const query = { email: email, password: password };
            try {
                const result = await usersCollection.findOne(query);
                // console.log(result)
                if (!result) {
                    return res.json({
                        status: 404,
                        message: "User does not exist with this credentials"
                    })
                }
                if(result.isVerified === false){
                    return res.json({
                        status: 401,
                        message: "User is not verified"
                    })
                }

                // Generate and send JWT token in the response
                const token = generateToken({ userId: result._id }); // Include any additional data you want in the payload
                res.json({
                    status: 200,
                    data: result,
                    jwt: token
                });
            } catch (err) {
                res.json({
                    status: 500,
                    message: "Internal Server Error"
                })
            }
        })

        // get all users
        app.get('/all-users', verifyJWT, async (req, res) => {
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
        app.get('/single-user/:id', verifyJWT, async (req, res) => {
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
        app.put('/update-user/:id', verifyJWT, async (req, res) => {
            const { id } = req.params;
            const query = { _id: new ObjectId(id) };
            const { data } = req.body;
            try {
                const getSingleUser = await usersCollection.findOne(query);
                if (!getSingleUser) {
                    return res.json({
                        status: 404,
                        message: "User not found"
                    });
                }

                // Construct the update object conditionally based on the fields in the data object
                const updateObject = {};
                if (data.name) updateObject.name = data.name;
                if (data.email) updateObject.email = data.email;
                if (data.password) updateObject.password = data.password;
                if (data.phone) updateObject.phone = data.phone;
                if (data.isVerified !== undefined) updateObject.isVerified = data.isVerified;
                if (data.image !== undefined) updateObject.image = data.image;
                if (data.location) updateObject.location = data.location;
                if (data.totalPost !== undefined) updateObject.totalPost = data.totalPost;
                if (data.rentSuccess !== undefined) updateObject.rentSuccess = data.rentSuccess;

                const result = await usersCollection.updateOne(query, { $set: updateObject });

                res.json({
                    status: 200,
                    data: result
                });
            } catch (err) {
                res.json({
                    status: 500,
                    message: "Internal Server Error"
                });
            }
        });
        // delete single user
        app.delete('/delete-user/:id', verifyJWT, async (req, res) => {
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
        app.post('/getVerificationCode', verifyJWT, async (req, res) => {
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
        app.post('/verifyOTP', verifyJWT, async (req, res) => {
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
        // update password
        app.put('/reset-password/:id', verifyJWT, async (req, res) => {
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
                const result = await usersCollection.updateOne(query, {
                    // schema validation 
                    $set: {
                        password: data.password,
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
        // create post
        app.post('/create-post', verifyJWT, async (req, res) => {
            const { data } = req.body;
            try {
                const result = await postsCollection.insertOne(data);
                // check schema validation
                res.json({
                    status: 200,
                    data: result
                })
            } catch (err) {
                res.json({
                    status: 200,
                    message: "Internal Server Error"
                })
            }
        })
        // get all posts
        app.get('/all-posts', verifyJWT, async (req, res) => {
            try {
                const result = await postsCollection.find().toArray();
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
        // get single post
        app.get('/single-post/:id', verifyJWT, async (req, res) => {
            const { id } = req.params;
            const query = { _id: new ObjectId(id) };
            try {
                const result = await postsCollection.findOne(query);
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
        // update single post
        // update single post
        app.put('/update-post/:id', verifyJWT, async (req, res) => {
            const { id } = req.params;
            const query = { _id: new ObjectId(id) };
            const { data } = req.body;
            try {
                const getSinglePost = await postsCollection.findOne(query);
                if (!getSinglePost) {
                    return res.json({
                        status: 404,
                        message: "Post not found"
                    });
                }


                // Construct the update object conditionally based on the fields in the data object
                const updateObject = {};
                if (data.location) updateObject.location = data.location;
                if (data.type) updateObject.type = data.type;
                if (data.isNegotiable !== undefined) updateObject.isNegotiable = data.isNegotiable;
                if (data.bedRoom !== undefined) updateObject.bedRoom = data.bedRoom;
                if (data.bathRoom !== undefined) updateObject.bathRoom = data.bathRoom;
                if (data.kitchen !== undefined) updateObject.kitchen = data.kitchen;
                if (data.drawingRoom !== undefined) updateObject.drawingRoom = data.drawingRoom;
                if (data.diningRoom !== undefined) updateObject.diningRoom = data.diningRoom;
                if (data.balcony !== undefined) updateObject.balcony = data.balcony;
                if (data.bills !== undefined) updateObject.bills = data.bills;
                if (data.img !== undefined) updateObject.img = data.img;
                if (data.price !== undefined) updateObject.price = data.price;
                if (data.additionalMessage !== undefined) updateObject.additionalMessage = data.additionalMessage;
                if (data.likeCount !== undefined) updateObject.likeCount = data.likeCount;
                if (data.isPublicNumber !== undefined) updateObject.isPublicNumber = data.isPublicNumber;
                if (data.isSold !== undefined) updateObject.isSold = data.isSold;
                if (data.isApproved !== undefined) updateObject.isApproved = data.isApproved;
                if (data.isAdminPost !== undefined) updateObject.isAdminPost = data.isAdminPost;

                const result = await postsCollection.updateOne(query, { $set: updateObject });

                res.json({
                    status: 200,
                    data: result
                });
            } catch (err) {
                res.json({
                    status: 500,
                    message: "Internal Server Error"
                });
            }
        });
        // delete single post
        app.delete('/delete-post/:id', verifyJWT, async (req, res) => {
            const { id } = req.params;
            const query = { _id: new ObjectId(id) };
            try {
                const result = await postsCollection.deleteOne(query);
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