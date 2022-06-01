const express = require('express')
const router = express.Router()
const db = require('../models')
const cryptoJS = require('crypto-js')
const bcrypt = require('bcryptjs')
const { default: axios } = require('axios')
const { append } = require('express/lib/response')
//Get /users/new - renders a form to add new users
router.get('/new',  (req, res) => {
    res.render('users/new.ejs', {msg: null})
})


//post /users - creates a new user and redirects to index
router.post('/', async (req, res) => {
    try {
        //try catch to create the user
        //TODO: hash password
        const hashedPassword = bcrypt.hashSync(req.body.password, 12)
        const [user, created] = await db.user.findOrCreate({
            where: {email: req.body.email },
            defaults: {password: req.body.password}
        })
        // if the user is new, log them in by giving them a cookie and redirect to the homepage(in the future this could redirect to profile etc.)
        if (created) {
            //res.cookie('cookie name', cookie data)
            //TODO: encrypt ID 
            const encryptedId = cryptoJS.AES.encrypt(user.id.toString(), process.env.ENC_KEY).toString()
            res.cookie('userId', encryptedId)
            res.redirect('users/pet')
        }else{
            // if the user was not created, re-render the login form with a message
            console.log('That email already exists')
            res.render('users/new.ejs', {msg: 'The email exists in the database already...'})
        }

    } catch (err) {
        console.log(err)
    }
})

// GET /users/login -- renders a login form
router.get('/login', (req, res) => {
    res.render('users/login.ejs', { msg: null })
})
// POST /users/login -- authenticates user credentials against the database
router.post('/login', async (req, res) => {
    try {
        // if the user is not found, display the login form and give them a message. Otherwise check the db
        const foundUser = await db.user.findOne({
            where: { email: req.body.email }
        })
        const msg = 'You are not authenticated.'
        if (!foundUser) {
            console.log('email not found')
            res.render('users/login.ejs', {msg})
            return // do not continue with the function
        }

    
        //if they match, give the user a cookie 
        const compare = bcrypt.compareSync(req.body.password, foundUser.password)
        if (compare) {
            const encryptedId = cryptoJS.AES.encrypt(foundUser.id.toString(),process.env.ENC_KEY).toString();
            res.cookie("userId", encryptedId)
            //To direct to profile instead of main page
            res.redirect('user/pet.ejs')
        } else {
            res.render('users/login.ejs', {msg})
        }

    } catch (error) {
        console.log(error)
    }
})
// GET /users/logout -- clear the coookie to log the user out

router.get('/logout',  (req, res) => {
   res.clearCookie("userId")
   res.redirect('/')

})

router.get('/pet', async (req, res) => {
     try {
      //check if user is authorized
      if (!res.locals.user) {
        // if the user is not authorized, ask them to log in
        res.render("users/login.ejs", { msg: "Your new best friend is waiting for you. Log in to connect:" });
        return; // end the route here
      }
      //this is where I am going to upload the images
      const url = "https://api.petfinder.com/v2/animals";
      const response = await axios({
        method: "get",
        url: url,
        headers: {
          Authorization:
            "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiJZbFNlMllCT3JwWkVVNmV6RnFIa2dzbXlVb3ZraWM3VjBWZjBZWTczQnVkYk1JSk93YSIsImp0aSI6IjYzNWY0MjdmMDE3OTA5YjgzZGFhZjIzNWRiODdmNWYxNjg2OGY0NzU4OTNhZmM5MzA0NWM2ODNiOTU5MTNkMjJjNDgwYjAyM2E4YTE2NWNhIiwiaWF0IjoxNjU0MTI0MjY4LCJuYmYiOjE2NTQxMjQyNjgsImV4cCI6MTY1NDEyNzg2OCwic3ViIjoiIiwic2NvcGVzIjpbXX0.oc8L50M-iqCuKkvacDY5eVOPNQcFQAZ6K7bDOzpFuRnuhjhaF4KqH5_qZ0lergFiOMvH6ggf-5xW-9a5eFxMW0R9NVCj66QFAWj3AidEr4SjMh3YzHkS38E18G2tqj9TMTCaH2SzTv0PcrpNxJ1o7FplNzGgBsSTDJLoNUHnuvvOQhG-UIztFw5ualTn39LEcIQkd-3GGlROTtWxKnGcPe7PdQiq8nVs9IQpU3_LR3A70lZDnFeSGESIHccFmlMh0WooGWu62ZiKiTSO-UNn5WXg_JtFSBtJ-t-SyboLnYJ0W7Ry4XHQxd98c_kcd4jvCP7_IxjjOuBF9vB_fyohHQ",
        },
      });
      const animals = await response.data.animals
      res.render('users/pet.ejs', {animals, user: res.locals.user})
    } catch (error) {
        console.log(error)
    }
})


router.get("/favorites", async (req, res) => {
  const favorites = await db.pet.findAll()
  console.log("KJDFBFVNQEFKNVKLKNNLK", favorites)
  // query for the user based on the cookie 
  // include db.pet
  // pass that object
  res.render("users/favorites.ejs", {allFavorites:favorites})
})

router.post('/favorites', async (req, res) => {
    try {
       
     if(!res.locals.user){
         res.render('users/login', {msg: 'log in'})
         return
     }
        const user = await db.user.findByPk(res.locals.user.dataValues.id)
        const [pet, created] = await db.pet.findOrCreate({
            where: {
                name: req.body.name
            }, defaults: {
                age: req.body.age,
                url: req.body.photos,

            }
        })
        await user.addPet(pet)
        const allFavorites = await db.pet.findAll()
        res.render("users/favorites", {allFavorites})
    } catch (error) {
        console.log(error)
    }
})


router.delete('/favorites', async (req, res) => {
    console.log(req.body.id)
    try {
        const instance = await db.pet.findOne({
        where: {
            id: req.body.id
        }
    })
    console.log(instance)
    await instance.destroy()
    res.redirect('/users/favorites')
  } catch (err) {
    console.log(err)
  }
})

router.get('/profile', async (req, res) => {
    try {
        if (!res.locals.user) {
          res.render("users/login.ejs", { msg: "Please log in to continue" })
          return
        }
        const comments = await db.comment.findAll({
            where: {
                userId: res.locals.user.dataValues.id
            }
        })
        res.render('users/profile.ejs', {comments, users:res.locals.user})
    } catch (error) {
        console.log(error)
    }
})

router.post('/profile', async (req, res) => {
    await db.comment.create({
      content: req.body.content,
      userId: req.body.userId
    })
    res.redirect('/users/profile')
})

router.put('/profile', async (req, res) => {
try {
    await db.comment.update({
      content: req.body.content,
      userId: req.body.userId,
    })
    res.redirect("/users/profile")
} catch (error) {
    console.log(error)
}
})


module.exports = router

