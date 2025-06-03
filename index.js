const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());





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

        // Get all jobs
        app.get('/jobs', async (req, res) => {
            const query = {};
            const cursor = jobCollection.find(query);
            const jobs = await cursor.toArray();
            res.send(jobs);
        });

        // Get single jobs
        app.get('/jobDetails/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const job = await jobCollection.findOne(query);
            res.send(job);
        });

        // Job Application api
        app.post('/job-application', async (req, res) => {
            const application = req.body;
            console.log('application', application);
            const result = await jobApplicationCollection.insertOne(application);
            res.send(result);
        });

        // Get Some Details form job applications
        app.get('/job-application', async (req, res) => {
            const email = req.query.email
            const query = { userEmail: email };
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
            console.log(id);
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