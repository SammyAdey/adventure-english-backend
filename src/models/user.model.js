"use strict";
// /src/models/user.model.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserCollection = exports.initUserCollection = void 0;
let usersCollection;
const initUserCollection = (db) => {
    usersCollection = db.collection("users");
    return usersCollection;
};
exports.initUserCollection = initUserCollection;
const getUserCollection = () => {
    if (!usersCollection) {
        throw new Error("User collection not initialized.");
    }
    return usersCollection;
};
exports.getUserCollection = getUserCollection;
