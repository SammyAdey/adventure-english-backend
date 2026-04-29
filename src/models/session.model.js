"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionCollection = exports.initSessionCollection = void 0;
let sessionCollection;
const initSessionCollection = (db) => {
    sessionCollection = db.collection("sessions");
    return sessionCollection;
};
exports.initSessionCollection = initSessionCollection;
const getSessionCollection = () => {
    if (!sessionCollection) {
        throw new Error("Session collection not initialized.");
    }
    return sessionCollection;
};
exports.getSessionCollection = getSessionCollection;
