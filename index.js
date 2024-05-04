const express = require("express");
const mongoose = require("mongoose");
const ejsMate = require("ejs-mate");
const path = require("path");
const methodOverride = require("method-override");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");
const session = require("express-session");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const Razorpay = require("razorpay");
const Payment = require("./models/payment");

dotenv.config();

const SECRET_KEY = process.env.SECRET_KEY;
const Case = require("./models/case");
const User = require("./models/user");
const Session = require("./models/session");
const { request } = require("http");

mongoose
  .connect(process.env.DBURL)
  // mongoose.connect('mongodb://127.0.0.1:27017/notes5', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("MONGO CONNECTION OPEN!!!");
  })
  .catch((err) => {
    console.log("OH NO MONGO CONNECTION ERROR!!!!");
    console.log(err);
  });

const razorpay = new Razorpay({
  key_id: "YOUR_KEY_ID",
  key_secret: "YOUR_KEY_SECRET",
});

const app = express();

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(session({ secret: "notagoodsecret" }));

//authentication ka
const returnLogin = (req, res, next) => {
  if (req.session.user_id) {
    return next();
  }
  res.redirect("/signin");
};

app.get("/", returnLogin, async (req, res) => {
  const _id = await req.session.user_id;
  const current = await User.findOne({ _id });
  const lawer = false;
  const cur = await Case.find();
  //console.log(cur);
  if (current.isLawer || current.isJudge) {
    res.render("lawer", {
      cur: cur,
      due: current.due,
      current: current,
      newcur: cur,
    });
  } else {
    res.render("home", { lawer: lawer, current: current, cur: cur });
  }
});

//later
// app.get("/about", (req, res) => {
//     var current = "";
//     // console.log(localStorage.getItem('loggedby_token'));
//     var token = localStorage.getItem('loggedby_token');
//     if (token) current = jwt.verify(localStorage.getItem('loggedby_token'), 'bhkdgrhikkghje');
//     return res.render("about", { current: current });
// })

app.get("/pastcases", returnLogin, async (req, res) => {
  const _id = await req.session.user_id;
  const current = await User.findOne({ _id });
  const cur = await Case.find({ closed: true });
  res.render("cases", { cur: cur, current: current });
});

app.get("/activecases", returnLogin, async (req, res) => {
  const _id = await req.session.user_id;
  const current = await User.findOne({ _id });
  const cur = await Case.find({ closed: false });
  var cases = [];
  for (let i = 0; i < cur.length; i++) {
    var today = new Date();
    if (
      cur[i].dateOfHearing.getDate() == today.getDate() &&
      cur[i].dateOfHearing.getMonth() == today.getMonth() &&
      cur[i].dateOfHearing.getYear() == today.getYear()
    ) {
      cases.push(cur[i]);
    }
  }
  res.render("cases", { cur: cases, current: current });
});

app.get("/upcomingcases", returnLogin, async (req, res) => {
  const _id = await req.session.user_id;
  const current = await User.findOne({ _id });
  const cur = await Case.find({ closed: false });
  var cases = [];
  for (let i = 0; i < cur.length; i++) {
    var today = new Date();
    if (
      cur[i].dateOfHearing.getDate() == today.getDate() &&
      cur[i].dateOfHearing.getMonth() == today.getMonth() &&
      cur[i].dateOfHearing.getYear() == today.getYear()
    ) {
      continue;
    } else {
      cases.push(cur[i]);
    }
  }
  res.render("cases", { cur: cases, current: current });
});

app.get("/allcases", returnLogin, async (req, res) => {
  const _id = await req.session.user_id;
  const current = await User.findOne({ _id });
  const cur = await Case.find();
  res.render("cases", { cur: cur, current: current });
});

app.get("/addcase", returnLogin, async (req, res) => {
  const _id = await req.session.user_id;
  const current = await User.findOne({ _id });
  if (current.isRegistrer == false) {
    return res.redirect("/");
  }
  res.render("addcase", { error: "" });
});

app.get("/signin", (req, res) => {
  res.render("signin", { error: "" });
});

app.get("/signup", (req, res) => {
  res.render("signup", { errors: "" });
});
app.get("/dummypayment", async (req, res) => {
  const _id = req.session.user_id;
  const user = await User.find({ _id });
  if (user.length === 0 || !user[0].isLawer) {
    return res.redirect("/");
  }
  const payments = await Payment.find({ user: _id });
  res.render("dummypayment", { payments: payments, due: user[0].due });
});
app.post("/makepayment", returnLogin, async (req, res) => {
  console.log("hi");
  // check if the user is a lawyer or a judge
  const _id = await req.session.user_id;
  const user = await User.find({ _id });
  if (!user[0].isLawer) {
    return res.redirect("/");
  }
  const { amount, status } = req.body;
  if (user[0].due < amount) {
    // make payement as failuer
    await Payment.create({ user: _id, amount, status: "Failed(Due Less)" });
  } else {
    if (status === "success") {
      user[0].due = parseInt(user[0].due) - parseInt(amount);
      await user[0].save();
    }
    await Payment.create({ user: _id, amount, status });
  }
  // dec due
  res.redirect("/dummyPayment");
});

app.post("/signup", async (req, res) => {
  const { email, username, secretkey, password, confirmPassword } = req.body;
  var errors = [];
  if (!username || !email || !secretkey || !confirmPassword || !password) {
    errors.push("Please Enter all Fields");
    res.render("signup", { errors: errors });
  } else if (
    email.substring(email.length - 10, email.length) != "@gmail.com" &&
    email.substring(email.length - 10, email.length) != "@yahoo.com" &&
    email.substring(email.length - 13, email.length) != "@iitism.ac.in" &&
    email.substring(email.length - 12, email.length) != "@outlook.com"
  ) {
    errors.push("Enter a valid email address");
    res.render("signup", { errors: errors });
  } else if (secretkey != SECRET_KEY) {
    errors.push("Enter a valid Secret Key");
    res.render("signup", { errors: errors });
  } else if (password != confirmPassword) {
    errors.push("Password and Confirm password doesn't match");
    res.render("signup", { errors: errors });
  } else if (password.length < 6) {
    errors.push("Password must contain minimum 6 characters");
    res.render("signup", { errors: errors });
  } else {
    try {
      const newUser = new User({ email, username, password });
      const exist = await User.findOne({ email });
      if (!exist) {
        await newUser.save();
        res.redirect("/signin");
      } else {
        await alert("email already registered");
        res.redirect("/signup");
      }
    } catch (e) {
      res.redirect("/signup");
    }
  }
});

app.post("/signin", async (req, res) => {
  const { username, password } = req.body;
  const exist = await User.findOne({ username });
  if (!exist) {
    res.render("signin", { error: "User Doesn't Exist" });
  } else if (exist.password != password) {
    res.render("signin", { error: "Incorrect Password" });
  } else {
    req.session.user_id = exist._id;
    res.redirect("/");
  }
});

app.get("/signout", async (req, res) => {
  await req.session.destroy();
  await res.redirect("/signin");
});

app.post("/addcase", returnLogin, async (req, res) => {
  const {
    caseTitle,
    defendantName,
    defendantAddress,
    crimeType,
    committedDate,
    committedLocation,
    arrestingOfficer,
    dateOfArrest,
    presidingJudge,
    publicProsecutor,
    dateOfHearing,
    completionDate,
  } = req.body;
  if (
    !caseTitle ||
    !defendantName ||
    !defendantAddress ||
    !crimeType ||
    !committedDate ||
    !committedLocation ||
    !arrestingOfficer ||
    !dateOfArrest ||
    !presidingJudge ||
    !publicProsecutor ||
    !dateOfHearing ||
    !completionDate
  ) {
    return res.render("addcase", { error: "Please Enter All Fields" });
  }
  const today = new Date();
  var td, tm;
  tm = today.getMonth() + 1;
  if (today.getDate() < 10) td = "0" + today.getDate();
  else td = today.getDate();
  if (tm < 10) tm = "0" + tm;
  else tm = today.getMonth();
  const todaysdate = "" + today.getFullYear() + "-" + tm + "-" + td;
  if (committedDate > todaysdate) {
    return res.render("addcase", {
      error: "Committed Date of Case Can't be in Future",
    });
  }
  if (dateOfArrest > todaysdate) {
    return res.render("addcase", {
      error: "Date of Arrest Can't be in Future",
    });
  }
  if (dateOfArrest < committedDate) {
    return res.render("addcase", {
      error: "Date of Arrest Can't be Earlier than Committed Date of Case",
    });
  }
  if (dateOfHearing < todaysdate) {
    return res.render("addcase", { error: "Date of Hearing Can't be in Past" });
  }
  if (completionDate < todaysdate) {
    return res.render("addcase", {
      error: "Expected Completion Date Can't be in Future",
    });
  }
  const db = await Case.find();
  const CIN = db.length + 1;
  const newcase = new Case({
    caseTitle: caseTitle,
    defendantName: defendantName,
    defendantAddress: defendantAddress,
    crimeType: crimeType,
    committedDate: committedDate,
    committedLocation: committedLocation,
    arrestingOfficer: arrestingOfficer,
    dateOfArrest: dateOfArrest,
    presidingJudge: presidingJudge,
    publicProsecutor: publicProsecutor,
    dateOfHearing: dateOfHearing,
    completionDate: completionDate,
    CIN: CIN,
    closed: false,
  });
  await newcase.save();
  res.redirect("/");
});

app.get("/case/:id", returnLogin, async (req, res) => {
  const _id = await req.session.user_id;
  const user = await User.find({ _id });
  const { id } = req.params;
  if (!user[0].isRegistrer) {
    user[0].due += 500;
    user[0].save();
  }
  const curr = await Case.findById(id).populate("sessions");
  // return res.send(currCase);
  console.log(user[0].isRegistrer);
  res.render("casedetails", { currCase: curr, user: user[0] });
});

app.post("/case/:id/addSession", returnLogin, async (req, res) => {
  const id = await req.params.id;
  const currCase = await Case.findById(id);
  const { attendingJudge, summary, nextHearingDate } = await req.body;
  const newSession = new Session({ attendingJudge, summary, nextHearingDate });
  await newSession.save();
  currCase.sessions.push(newSession.id);
  await currCase.save();
  return res.redirect("/");
});

app.post("/case/:id/closeCase", returnLogin, async (req, res) => {
  const id = req.params.id;
  const curcase = await Case.findById(id);
  curcase.closed = true;
  await curcase.save();
  return res.redirect("/");
});

app.post("/addjudge", returnLogin, async (req, res) => {
  const _id = await req.session.user_id;
  const adderdetails = await User.findOne({ _id });
  if (adderdetails.isRegistrer == false) {
    return res.redirect("/");
  }
  const { emailJudge, userNameJudge, passwordJudge } = req.body;
  const exist = await User.findOne({ username: userNameJudge });
  if (!exist) {
    const newuser = new User({
      email: emailJudge,
      username: userNameJudge,
      password: passwordJudge,
      isRegistrer: false,
      isJudge: true,
      isLawer: false,
      due: 0,
    });
    await newuser.save();
  }
  res.redirect("/");
});

app.post("/addlawer", returnLogin, async (req, res) => {
  const _id = await req.session.user_id;
  const adderdetails = await User.findOne({ _id });
  if (adderdetails.isRegistrer == false) {
    return res.redirect("/");
  }
  const { emailLawyer, userNameLawyer, passwordLawyer } = req.body;
  const exist = await User.findOne({ username: userNameLawyer });
  if (!exist) {
    const newuser = new User({
      email: emailLawyer,
      username: userNameLawyer,
      password: passwordLawyer,
      isRegistrer: false,
      isJudge: false,
      isLawer: true,
      due: 0,
    });
    await newuser.save();
  }
  res.redirect("/");
});

// app.get('/payment-overlay', (req, res) => {
//     res.render('payment-overlay');
// });

// // 2. Handle Payment Request
// app.post('/initiate-payment', async (req, res) => {
//     const paymentAmount = req.body.amount;
//     const options = {
//         amount: paymentAmount, // Amount in paise (e.g., 50000 paise = ₹500)
//         currency: 'INR',
//         receipt: 'receipt_order_74394',
//         payment_capture: '1'
//     };

//     try {
//         const response = await razorpay.orders.create(options);
//         res.json(response);
//     } catch (error) {
//         console.error(error);
//         res.status(500).send('Failed to create Razorpay order');
//     }
// });

// // 3. Handle Payment Callback
// app.post('/payment-callback', (req, res) => {
//     const paymentId = req.body.razorpay_payment_id;
//     const orderId = req.body.razorpay_order_id;
//     const signature = req.body.razorpay_signature;

//     // Verify the signature

//     // Update payment status in the database

//     res.send('Payment successful');
// });

// // 4. Update Page Status
// // You might update the payment status in a database

// // 5. Render the Page
// app.get('/main-page', (req, res) => {
//     // Check payment status from the database
//     const paymentStatus = 'fail'// Get payment status from the database
//     if (paymentStatus === 'success') {
//         res.render('main-page'); // Render full page content
//     } else {
//         res.render('payment-pending'); // Show message indicating payment pending
//     }
// });

app.get("/changepassword", returnLogin, async (req, res) => {
  const _id = await req.session.user_id;
  const current = await User.findOne({ _id });
  var error = [];
  res.render("changePassword", { current: current, error: error });
});

app.post("/changepassword", returnLogin, async (req, res) => {
  const _id = await req.session.user_id;
  const exist = await User.findOne({ _id });
  const error = [];
  if (req.body.currentPassword != exist.password) {
    error.push("Please Enter Valid Current Password");
    res.render("changePassword", { error: error, current: exist });
  } else if (req.body.newPassword.length < 6) {
    error.push("New Password Must be Atleast 6 Characters");
  } else if (req.body.newPassword != req.body.confirmPassword) {
    error.push("New Password and Confirm New Password Not Matching");
  }
  if (error.length > 0) {
    return res.render("changePassword", { error: error, current: exist });
  }
  exist.password = req.body.newPassword;
  exist.save();
  res.redirect("/");
});

app.use("*", (req, res) => {
  res.render("pageNotFound");
});

app.listen(9000, () => {
  console.log("listening on port 9000....");
});
