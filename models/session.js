const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const sessionSchema = new mongoose.Schema({
    attendingJudge: {
        type: String,
        required: true
    },
   summary: {
    type: String,
    required: true
   },
   nextHearingDate: {
    type: String,
    required: true
   }
   
});


module.exports = mongoose.model('Session', sessionSchema);
// One to many relationship -> one case many comments. So we store reference to comments in case.