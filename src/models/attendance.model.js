"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAttendanceCollection = exports.initAttendanceCollection = void 0;
let attendanceCollection;
const initAttendanceCollection = (db) => {
    attendanceCollection = db.collection("attendance");
    return attendanceCollection;
};
exports.initAttendanceCollection = initAttendanceCollection;
const getAttendanceCollection = () => {
    if (!attendanceCollection) {
        throw new Error("Attendance collection not initialized.");
    }
    return attendanceCollection;
};
exports.getAttendanceCollection = getAttendanceCollection;
