"use strict";
// /src/models/course.model.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCourseCollection = exports.initCourseCollection = void 0;
let coursesCollection;
const initCourseCollection = (db) => {
    coursesCollection = db.collection("courses");
    return coursesCollection;
};
exports.initCourseCollection = initCourseCollection;
const getCourseCollection = () => {
    if (!coursesCollection) {
        throw new Error("Course collection not initialized.");
    }
    return coursesCollection;
};
exports.getCourseCollection = getCourseCollection;
