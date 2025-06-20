const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
require('dotenv').config()
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'https://job-portal-a50f8.firebaseapp.com', 'https://job-portal-a50f8.web.app'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser())

// for verify token 
const logger = (req, res, next) => {
    // console.log('Hello world Is login Yes!');
    next();
}

const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token;
    // console.log(token);
    // if token is not have. then is loop will run.
    if (!token) {
        return res.status(401).send({ message: 'there is a error in token or Unauthorized !!' })
    }
    // if token is there but not matching then this loop will run.
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'Unauthorized Public is here!!' })
        }
        req.user = decoded
        next()
    })
}





const uri = `mongodb+srv://${process.env.DB_USR}:${process.env.DB_PWD}@cluster0.fxqoncr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        // job portal database working here

        const jobCollection = client.db('jobPortal').collection('jobs');
        const jobApplicationCollection = client.db('jobPortal').collection('job_Applications');


        // ================= Auth related api =====================
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            // create token here
            const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' })
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure:  true,  // process.env.NODE_ENV === "production" // when https use then the value is true
                    sameSite: 'None'

                })
                .send({ success: true })
        })

        app.post('/logout', (req, res) => {
            res
                .clearCookie('token', {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'None'
                })
                .send({ message: "Successfully Logout USER." })
        })


        // =============== Job related apis =======================
        // Get all jobs
        app.get('/jobs', async (req, res) => {
            const email = req.query.email // query use for only search box in write.
            let query = {};
            if (email) {
                query = {
                    hr_email: email
                }
            }
            const cursor = jobCollection.find(query);
            const jobs = await cursor.toArray();
            res.send(jobs);
        });

        app.get('/jobs/user', verifyToken, async (req, res) => {
            const email = req?.query?.email;
            let query = {};
            if (email) {
                query = {
                    hr_email: email
                }
            }
            if (req.user.email !== req.query.email) {
                return res.status(403).send({ message: "You are forbidden access!!" })
            }
            const cursor = jobCollection.find(query);
            const jobs = await cursor.toArray();
            res.send(jobs);
        })

        // Get single jobs
        app.get('/jobDetails/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const job = await jobCollection.findOne(query);
            res.send(job);
        });
        // Create a New Job 
        app.post('/jobs', async (req, res) => {
            const newJob = req.body;
            const result = await jobCollection.insertOne(newJob)
            res.send(result)
        })


        // ================== Job Application related apis ====================
        app.post('/job-application', async (req, res) => {
            const application = req.body;
            // console.log('application', application);
            const result = await jobApplicationCollection.insertOne(application);

            // Not the best way (use aggregate)
            const id = application.jobId
            const query = { _id: new ObjectId(id) }
            const job = await jobCollection.findOne(query);
            let newCount = 0;
            if (job.applicationCount) {
                newCount = job.applicationCount + 1
            }
            else {
                newCount = 1;
            }
            // Now update the job info
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    applicationCount: newCount
                }
            }

            const updatedResult = await jobCollection.updateOne(filter, updatedDoc);
            // console.log(job);
            res.send(result);
        });

        app.patch('/job-application/:id', async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    status: data.status
                }
            }
            const result = await jobApplicationCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        //======================== get total applying user details. or PostedJob =====================
        app.get('/job-application/jobs/:job_id', async (req, res) => {
            const job_id = req.params.job_id;
            const query = { jobId: job_id }
            const result = await jobApplicationCollection.find(query).toArray()
            // console.log(result);
            res.send(result)
        })

        // Get Some Details form job applications
        app.get('/job-application', verifyToken, async (req, res) => {
            const email = req.query.email
            const query = { userEmail: email };

            if (req.user.email !== req.query.email) {
                return res.status(403).send({ message: "You are forbidden access!!" })
            }

            // console.log('cuk cuk cookies : ', req.cookies);

            const cursor = jobApplicationCollection.find(query);
            const applications = await cursor.toArray();

            for (const application of applications) {
                const jobId = application.jobId;
                const jobQuery = { _id: new ObjectId(jobId) };
                const job = await jobCollection.findOne(jobQuery);
                if (job) {
                    application.title = job.title;
                    application.company = job.company;
                    application.company_logo = job.company_logo;
                    application.jobType = job.jobType;
                    application.location = job.location;
                    application.name = job.hr_name || 'John Doe';
                }
            }
            res.send(applications);
        });

        // Get Delete a job application
        app.delete('/job-application/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const query = { _id: new ObjectId(id) };
            const result = await jobApplicationCollection.deleteOne(query);
            res.send(result);
        });

    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



// Routes
app.get('/', (req, res) => {
    res.send('Welcome to the API! In Job Portal');
});


// listen for requests
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});


// ===============================================================================


// MARKED + FIXED VERSION of your code for VERCEL DEPLOYMENT

// const express = require('express');
// const serverless = require('serverless-http');
// const cors = require('cors');
// const jwt = require('jsonwebtoken');
// const cookieParser = require('cookie-parser');
// const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// require('dotenv').config();

// const app = express();

// // ============ FIXED Middleware ============
// app.use(cors({
//     origin: [
//         'http://localhost:5173',
//         'https://job-portal-a50f8.firebaseapp.com',
//         'https://job-portal-a50f8.web.app'
//     ],
//     credentials: true
// }));
// app.use(express.json());
// app.use(cookieParser());

// // ============ VERIFY TOKEN ============
// const verifyToken = (req, res, next) => {
//     const token = req?.cookies?.token;
//     if (!token) {
//         return res.status(401).send({ message: 'Unauthorized: No token provided' });
//     }
//     jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
//         if (err) {
//             return res.status(401).send({ message: 'Unauthorized: Invalid token' });
//         }
//         req.user = decoded;
//         next();
//     });
// };

// // ============ MONGODB CLIENT with CACHE ============
// let cachedClient = null;
// async function getClient() {
//     if (cachedClient) return cachedClient;
//     const uri = `mongodb+srv://${process.env.DB_USR}:${process.env.DB_PWD}@cluster0.fxqoncr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
//     const client = new MongoClient(uri, {
//         serverApi: {
//             version: ServerApiVersion.v1,
//             strict: true,
//             deprecationErrors: true
//         },
//         connectTimeoutMS: 60000,
//         serverSelectionTimeoutMS: 60000,
//         maxPoolSize: 1
//     });
//     await client.connect();
//     cachedClient = client;
//     return client;
// }

// // ============ MAIN ROUTES ============
// app.post('/jwt', async (req, res) => {
//     const user = req.body;
//     const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });
//     res
//         .cookie('token', token, {
//             httpOnly: true,
//             secure: process.env.NODE_ENV === 'production'
//         })
//         .send({ success: true });
// });

// app.post('/logout', (req, res) => {
//     res
//         .clearCookie('token', {
//             httpOnly: true,
//             secure: process.env.NODE_ENV === 'production'
//         })
//         .send({ message: 'Successfully Logged Out' });
// });

// app.get('/jobs', async (req, res) => {
//     try {
//         const client = await getClient();
//         const email = req.query.email;
//         let query = {};
//         if (email) query.hr_email = email;
//         const jobs = await client.db('jobPortal').collection('jobs').find(query).toArray();
//         res.send(jobs);
//     } catch (err) {
//         console.error(err);
//         res.status(500).send({ message: 'Internal Server Error' });
//     }
// });

// app.get('/jobs/user', verifyToken, async (req, res) => {
//     try {
//         const email = req.query.email;
//         if (req.user.email !== email) return res.status(403).send({ message: 'Forbidden Access' });
//         const client = await getClient();
//         const jobs = await client.db('jobPortal').collection('jobs').find({ hr_email: email }).toArray();
//         res.send(jobs);
//     } catch (err) {
//         console.error(err);
//         res.status(500).send({ message: 'Internal Server Error' });
//     }
// });

// app.get('/jobDetails/:id', async (req, res) => {
//     try {
//         const client = await getClient();
//         const job = await client.db('jobPortal').collection('jobs').findOne({ _id: new ObjectId(req.params.id) });
//         res.send(job);
//     } catch (err) {
//         res.status(500).send({ message: 'Job not found' });
//     }
// });

// app.post('/jobs', async (req, res) => {
//     try {
//         const client = await getClient();
//         const result = await client.db('jobPortal').collection('jobs').insertOne(req.body);
//         res.send(result);
//     } catch (err) {
//         res.status(500).send({ message: 'Failed to create job' });
//     }
// });

// app.post('/job-application', async (req, res) => {
//     try {
//         const client = await getClient();
//         const application = req.body;
//         const result = await client.db('jobPortal').collection('job_Applications').insertOne(application);

//         const jobId = application.jobId;
//         const job = await client.db('jobPortal').collection('jobs').findOne({ _id: new ObjectId(jobId) });
//         const newCount = (job.applicationCount || 0) + 1;
//         await client.db('jobPortal').collection('jobs').updateOne(
//             { _id: new ObjectId(jobId) },
//             { $set: { applicationCount: newCount } }
//         );
//         res.send(result);
//     } catch (err) {
//         res.status(500).send({ message: 'Failed to submit application' });
//     }
// });

// // NOTE: Other routes can follow same pattern (wrap with try/catch and use getClient)

// // ============ WELCOME ROUTE ============
// app.get('/', (req, res) => {
//     res.send('Welcome to the Job Portal API');
// });

// // ============ EXPORT FOR VERCEL ============
// module.exports = app;
// module.exports.handler = serverless(app);
