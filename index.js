const express = require("express")
const cors = require("cors")
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
const { ObjectId } = require('mongodb');
require('dotenv').config()
const nodemailer = require('nodemailer');
const multer = require('multer');

const app = express()
const port = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(express.json())

// Simulated blacklist of invalidated tokens
const invalidatedTokens = new Set();

// Middleware to verify JWT
function verifyJWT(req, res, next) {
    const token = req.header('Authorization');

    if (!token) {
        return res.status(401).json({ status: 401, message: 'Authorization token missing' });
    }

    if (invalidatedTokens.has(token)) {
        return res.status(401).json({ status: 401, message: 'Token has been invalidated' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ status: 403, message: 'Invalid JWT token' });
    }
}


// Generate JWT token function
function generateToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET);
}

app.get('/logout', (req, res) => {
    const token = req.query.jwt;
    if (!token) {
        return res.status(400).json({ status: 400, message: 'JWT query parameter missing' });
    }

    invalidatedTokens.add(token);
    res.json({ message: 'Token invalidated' });
});

// mongodb connection
const uri = process.env.MONGODB_URI;
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

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Specify the upload directory
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname); // Specify the filename
    },
});

const upload = multer({ storage });

// Serve static files from the uploads directory to the /uploads route for image preview
app.use('/uploads', express.static('uploads'));

async function run() {
    try {
        // await client.connect();
        const database = client.db('nir');
        const usersCollection = database.collection('users');
        const otpCollection = database.collection('otp');
        const postsCollection = database.collection('posts');
        const notificationsCollection = database.collection('notifications');
        const subscriptionsCollection = database.collection('subscriptions');

        // Define the file upload route
        app.post('/upload', upload.array('files'), (req, res) => {
            try {
                const uploadedFiles = req.files;

                if (!uploadedFiles || uploadedFiles.length === 0) {
                    return res.status(400).json({ message: 'No files uploaded' });
                }

                const fileNames = uploadedFiles.map(file => file.filename);
                console.log('Files uploaded:', fileNames);

                // You can do further processing with the uploaded files here

                return res.status(200).json({ message: 'Files uploaded successfully', fileNames });
            } catch (error) {
                console.error('Error uploading files:', error);
                return res.status(500).json({ message: 'Internal Server Error' });
            }
        });

        // create user
        app.post('/register', async (req, res) => {
            const { data } = req.body;
            const { email } = data;
            // add createdAt time
            data.createdAt = new Date();
            data.updatedAt = new Date();
            try {
                // CHECK if the email are already exist or not
                const existingUser = await usersCollection.findOne({ email })
                if (existingUser) {
                    return res.json({
                        status: 400,
                        message: "This email is already registered"
                    })
                }

                // if email is not already registerd,
                const result = await usersCollection.insertOne(data);
                const resultData = await usersCollection.findOne({ email});
                // Generate and send JWT token in the response
                const token = generateToken({ userId: result.insertedId }); // Include any additional data you want in the payload
                res.json({
                    status: 200,
                    data: result,
                    responseData: resultData,
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
                if (result.isVerified === false) {
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
                const result = await usersCollection.find({}).toArray();
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
        // get unverified users
        app.get('/all-unverified-users', verifyJWT, async (req, res) => {
            try {
                const result = await usersCollection.find({
                    isVerified: false
                }).toArray();
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
            const query = { _id: new ObjectId(id)};
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
        app.put('/update-user/:id', verifyJWT, upload.single('file'), async (req, res) => {
            const { id } = req.params;
            console.log(id)
            const query = { _id: new ObjectId(id) };
            const { data } = req.body;
            console.log('hit')
            console.log(req.file, 'file')
            try {
                const getSingleUser = await usersCollection.findOne(query);
                console.log(getSingleUser)
                if (!getSingleUser) {
                    return res.json({
                        status: 404,
                        message: "User not found"
                    });
                }

                // Construct the update object conditionally based on the fields in the data object
                let updateObject = {};
                if (data?.name !== undefined) updateObject.name = data?.name;
                if (data?.email) updateObject.email = data?.email;
                if (data?.password) updateObject.password = data?.password;
                if (data?.phone !== undefined) updateObject.phone = data?.phone;
                if (data?.isVerified !== undefined) updateObject.isVerified = data?.isVerified;
                if (data?.image !== undefined) updateObject.image = data?.image;
                if (data?.location) updateObject.location = data?.location;
                if (data?.totalPost !== undefined) updateObject.totalPost = data?.totalPost;
                if (data?.rentSuccess !== undefined) updateObject.rentSuccess = data?.rentSuccess;
                if (data?.isAdmin !== undefined) updateObject.isAdmin = data?.isAdmin;
                if (data?.lookingFor !== undefined) updateObject.lookingFor = data?.lookingFor;
                if (data?.accountType !== undefined) updateObject.accountType = data?.accountType;
                if (data?.subscriptionStatus !== undefined) updateObject.subscriptionStatus = data?.subscriptionStatus;
                if (data?.subscriptionId !== undefined) updateObject.subscriptionId = data?.subscriptionId;
                if (data?.expiresIn !== undefined) updateObject.expiresIn = data?.expiresIn;
                if (data?.bkash !== undefined) updateObject.bkash = data?.bkash;
                if (data?.rocket !== undefined) updateObject.rocket = data?.rocket;
                if (data?.nagad !== undefined) updateObject.nagad = data?.nagad;
                if (data?.isBanned !== undefined) updateObject.isBanned = data?.isBanned;
                // add update time
                updateObject.updatedAt = new Date();
                // Check if req.file exists (image uploaded)
                if (req.file) {
                    updateObject.image = req.file.filename; // Save the uploaded filename
                    // console.log('aise')
                }
                console.log(updateObject)
                const result = await usersCollection.updateOne(query, { $set: updateObject });
                // console.log(result);
                res.json({
                    status: 200,
                    data: result
                });
            } catch (err) {
                console.log(err)
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
                // Fetch the UserID from the JWT token
                const userId = req.user.userId;
                res.json({
                    status: 200,
                    message: userId,
                    userID: userId

                });
            } else {
                res.json({
                    status: 400,
                    message: "Invalid OTP"
                });
            }
        });

        // update password
        app.put('/reset-password', async (req, res) => {
            const { data } = req.body;
            const email = data.email;
            const query = { email: email };
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
        app.post('/create-post', verifyJWT, upload.single('file'), async (req, res) => {
            const { data } = req.body;

            // add createdAt time and updatedAt time
            data.createdAt = new Date();
            data.updatedAt = new Date();
            try {
                // Check if req.file exists (image uploaded)
                if (req?.file) {
                    console.log('file exists')
                    data.image = req.file.filename;
                }
                console.log(data)
                const result = await postsCollection.insertOne(data);
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
        app.get('/all-posts', async (req, res) => {
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
        // get all posts that is not approved
        app.get('/pending-posts', verifyJWT, async (req, res) => {
            try {
                const result = await postsCollection.find({
                    isApproved: false
                }).toArray();
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
        // get all approved posts
        app.get('/approved-posts', async (req, res) => {
            try {
                const result = await postsCollection.find({
                    isApproved: true
                }).toArray();
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




        // get all nearest approved posts
        app.get('/nearest-posts/:location', verifyJWT, async (req, res) => {
            const { location } = req.params;
            // make location case insensitive
            console.log(location)
            const query = { location: { $regex: new RegExp(location, 'i') } };
            // also get only approved posts
            query.isApproved = true;
            try {
                const result = await postsCollection.find(query).toArray();
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
        // get single post by userId
        app.get('/single-post-by-userId/:id', verifyJWT, async (req, res) => {
            const { id } = req.params;
            // console.log(id)
            const query = { userId: id };
            try {
                const result = await postsCollection.find(query).toArray();
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
                // add update time
                updateObject.updatedAt = new Date();

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
        app.delete('/delete-post/:id', async (req, res) => {
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


        // create notification if vendor approve req from user
        app.post('/create-notification', async (req, res) => {
            try {
                const { data } = req.body;
                // add createdAt time and updatedAt time
                data.createdAt = new Date();
                data.updatedAt = new Date();
                const result = await notificationsCollection.insertOne(data);
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
        // get all notifications by userId
        app.get('/to-notifications/:id', async (req, res) => {
            const { id } = req.params;
            try {

                // query is if to data find then check filed if senderType is equal to "receiver" then find the data
                const query = { to: id, senderTo: "receiver" };
                const result = await notificationsCollection.find(query).toArray();

                // const query = { to: id };
                // const result = await notificationsCollection.find(query).toArray();
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
        // get notification by ownerId
        app.get('/from-notifications/:id', async (req, res) => {
            const { id } = req.params;
            try {

                // query is if from data find then check filed if senderType is equal to "sender" 
                const query = { from: id, senderFrom: "sender" };
                const result = await notificationsCollection.find(query).toArray();
                
            


                // const query = { from: id };
                // const result = await notificationsCollection.find(query).toArray();
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
        // get notification by postId
        app.get('/post-notifications/:id', async (req, res) => {
            const { id } = req.params;
            try {
                const query = { postId: id };
                const result = await notificationsCollection.find(query).toArray();
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
        // patch update notification
        app.patch('/update-notification/:id', async (req, res) => {
            const { id } = req.params;
            const { data } = req.body;
            try {
                const query = { _id: new ObjectId(id) };
                const getSingleNotification = await notificationsCollection.findOne(query);
                if (!getSingleNotification) {
                    return res.json({
                        status: 404,
                        message: "Notification not found"
                    });
                }
                // Construct the update object
                const updateObject = {};
                if (data.status !== undefined) updateObject.status = data.status;
                if (data.ownerRead !== undefined) updateObject.ownerRead = data.ownerRead;
                if (data.userRead !== undefined) updateObject.userRead = data.userRead;
                if(data.senderFrom !== undefined) updateObject.senderFrom = data.senderFrom;
                if(data.senderTo !== undefined) updateObject.senderTo = data.senderTo;
                // add update time
                updateObject.updatedAt = new Date();

                const result = await notificationsCollection.updateOne(query, { $set: updateObject });

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

        //get all notification
        app.get('/all-notifications', async (req, res) => {
            try {
                const result = await notificationsCollection.find().toArray();
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

        // get single post by postId
        app.get('/single-notification/:id', async (req, res) => {
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
        // delete single notification
        app.delete('/delete-notification/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const query = { _id: new ObjectId(id) };
                const result = await notificationsCollection.deleteOne(query);
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

        // make payment
        app.post('/make-payment', async (req, res) => {
            try {
                const { data } = req.body;
                // check session_id already exists or not
                const existingPayment = await subscriptionsCollection.findOne({ session_id: data.session_id });
                if (existingPayment) {
                    return res.json({
                        status: 403,
                        message: "Payment already done"
                    });
                }

                // make the post_id able post isAds = true
                const query = { _id: new ObjectId(data.post_id) };
                const getSinglePost = await postsCollection.findOne(query);
                if (!getSinglePost) {
                    return res.json({
                        status: 404,
                        message: "Post not found"
                    });
                }

                // Update the post to set isAds to true
                const updateResult = await postsCollection.updateOne(query, { $set: { isAds: true } });

                // Insert data into subscriptionsCollection
                data.createdAt = new Date();
                await subscriptionsCollection.insertOne(data);

                res.json({
                    status: 200,
                    data: data
                });
            } catch (err) {
                res.json({
                    status: 500,
                    message: "Internal Server Error"
                });
            }
        });

        // get all subscriptions 
        app.get('/all-subscriptions', async (req, res) => {
            try {
                const result = await subscriptionsCollection.find().toArray();
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



        // create favorite post
        app.post('/create-favorite', async (req, res) => {
            try {
                const { data } = req.body;
                // add createdAt time and updatedAt time
                data.createdAt = new Date();
                data.updatedAt = new Date();
                // insert id in the users facvorite array
                const query = { _id: new ObjectId(data.userId) };
                const getSingleUser = await usersCollection.findOne(query);
                if (!getSingleUser) {
                    return res.json({
                        status: 404,
                        message: "User not found"
                    });
                }
                const postId = data.postId;
                // if no favoritePosts array exists, create one and push the postId and if exists, push the postId
                const resultUser = await usersCollection.updateOne
                    (query,
                        { $push: { "favoritePosts": postId } }
                    );

                res.json({
                    status: 200,
                    data: resultUser
                })
            } catch (err) {
                res.json({
                    status: 500,
                    message: "Internal Server Error"
                })
            }
        })

        
        // get all favorite posts by userId
        app.get('/user-favorites/:id', async (req, res) => {
            try {
                const { id } = req.params;
                // get the favoritePosts array from the user
                const query = { _id: new ObjectId(id) };
                const result = await usersCollection.findOne(query);
                // give all the favorite posts by the postId
                const favoritePosts = result?.favoritePosts;
                const favoritePostsArray = [];
                for (const favoritePost of favoritePosts) {
                    const query = { _id: new ObjectId(favoritePost) };
                    const result = await postsCollection.findOne(query);
                    favoritePostsArray.push(result);
                }
                res.json({
                    status: 200,
                    data: favoritePostsArray
                })


            } catch (err) {
                res.json({
                    status: 500,
                    message: "Internal Server Error"
                })
            }
        })
        // update favorite post bv userId : remove favorite post
        app.patch('/update-favorite/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const query = { _id: new ObjectId(id) };

                // if check the postId exists in the favoritePosts array, remove it
                if (req.body.postId) {
                    const result = await usersCollection.updateOne
                        (query,
                            { $pull: { "favoritePosts": req.body.postId } }
                        );
                    res.json({
                        status: 200,
                        data: result
                    })
                } else {
                    res.json({
                        status: 404,
                        message: "Post not found"
                    })
                }

            } catch (err) {
                res.json({
                    status: 500,
                    message: "Internal Server Error"
                })
            }
        })

        // get specific favorite post by userId and postId and response boolean
        app.get('/specific-favorite/:userId/:postId', async (req, res) => {
            try {
                const { userId, postId } = req.params;
                const query = { _id: new ObjectId(userId) };
                const result = await usersCollection.findOne(query);
                const favoritePosts = result?.favoritePosts;
                const isFavorite = favoritePosts.includes(postId);
                res.json({
                    status: 200,
                    data: isFavorite
                })
            } catch (err) {
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