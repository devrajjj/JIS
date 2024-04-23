const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const userSchema = new Schema({
    email:{
        type: String,
        required: true,
        unique: true
    },
    username: {
        type: String,
        required: true,
        unique: true
    },
    password:{
        type: String,
        required: true,
    },
    isRegistrer:{
        type: Boolean,
        default: true
    },
    isJudge:{
        type: Boolean,
        default: false
    },
    isLawer:{
        type: Boolean,
        default: false
    },
    due:{
        type:Number,
        default: 0
    }
})

module.exports = mongoose.model('User', userSchema);