// dependências

const express = require('express')

const admin = require('firebase-admin');

let Busboy = require('busboy');

let path = require('path')
let os = require('os')
let fs = require('fs')
let UUID = require('uuid-v4')

//configuração - firebase

let serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "instadu-fe8b8.appspot.com"
});

let db = admin.firestore();
let bucket = admin.storage().bucket();

//configuração - express

const app = express()
const port = 3000

// endpoint (rota?)

app.get('/', (request, response) => {
    response.send('Servidor para o Instadu!!')
    console.log('Rota raiz funcionando')
})
// endpoint - posts

app.get('/posts', (request, response) => {
    response.set('Access-Control-Allow-Origin', '*')

    let posts = []

    db.collection('posts').orderBy('date', 'desc').get()
        .then((snapshot) => {
            snapshot.forEach((doc) => {
                posts.push(doc.data())
            })

            response.send(posts)
        })
        .catch((err) => {
            response.send(err)
        })

})
// endpoint - createPost

app.post('/createPost', (request, response) => {
    response.set('Access-Control-Allow-Origin', '*')

    let uuid = UUID()

    let busboy = new Busboy({ headers: request.headers })

    let fields = {}
    let fileData = {}

    busboy.on('file', function (fieldName, file, filename, encoding, mimetype) {
        //console.log('File [' + fieldName + ']: filename: ' + filename + ', encoding: ' + encoding + ', mimetype: ' + mimetype)

        // acessando o temp folder

        console.log(os.tmpdir(), filename)

        let filePath = path.join(os.tmpdir(), filename)
        file.pipe(fs.createWriteStream(filePath))

        fileData = { filePath, mimetype }

    })

    busboy.on('field', function (fieldName, val, fieldNameTruncated, valTruncated, encoding, mimetype) {
        //console.log('Field [' + fieldName + ']: value: ' + inspect(val))
        fields[fieldName] = val
    })

    busboy.on('finish', function () {

        // fazer upload do arquivo

        bucket.upload(fileData.filePath, {
            uploadType: 'media',
            metadata: {
                metadata: {
                    contentType: fileData.mimetype,
                    firebaseStorageDownloadTokens: uuid
                }
            }

        }, (err, uploadedFile) => {
            if (!err) { createDocument(uploadedFile) }
        })

        function createDocument(uploadedFile) {
            // Add a new document in collection
            db.collection('posts').doc(fields.id).set({
                id: fields.id,
                caption: fields.caption,
                location: fields.location,
                date: parseInt(fields.date),
                imageUrl: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${uploadedFile.name}?alt=media&token=${uuid}`
            }).then(() => {
                response.send('Post Added: ' + fields.id)
            }).catch(console.error)

        }
    })

    request.pipe(busboy)


})

//escutando

app.listen(process.env.PORT || port, () => {
    console.log(`Example app listening at port :${port}`)
})
