const mongoose = require('mongoose');

module.exports.dbConnect = async () => {
    const mode = process.env.mode
    try {
        if (mode === 'production') {
            await mongoose.connect(process.env.DB_URL, { useNewURLParser: true })
            console.log("Production database connect....")
        } else {
            await mongoose.connect(process.env.DB_URL, { useNewURLParser: true })
            console.log("Local database connect....")
        }

    } catch (error) {
        console.log(error.message)
    }
}