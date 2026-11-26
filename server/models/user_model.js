// user_model.js - model for the users collection in the database
// Author: Reachnid Group
// Centennial College - Fall 2026

//=============================================================
//                          IMPORTS
//=============================================================

// import mongoose & schema
import mongoose from 'mongoose';
const { Schema } = mongoose;

//=============================================================
//                          SCHEMA
//=============================================================

// create a schema for the users collection
const userSchema = new Schema({
  // display name, exactly as the player typed it
  name: { type: String, required: true },

  // lowercase copy of the name, so names are unique regardless of case
  nameLower: { type: String, required: true, unique: true },

  // bcrypt hash of the password (the password itself is never stored)
  passwordHash: { type: String, required: true },

  createdAt: { type: Date, default: Date.now },
});

//=============================================================
//                          EXPORTS
//=============================================================

// export the model to be used in other files
export default mongoose.model('User', userSchema);
