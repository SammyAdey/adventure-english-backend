"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCohortCollection = exports.initCohortCollection = void 0;
let cohortCollection;
const initCohortCollection = (db) => {
    cohortCollection = db.collection("cohorts");
    return cohortCollection;
};
exports.initCohortCollection = initCohortCollection;
const getCohortCollection = () => {
    if (!cohortCollection) {
        throw new Error("Cohort collection not initialized.");
    }
    return cohortCollection;
};
exports.getCohortCollection = getCohortCollection;
