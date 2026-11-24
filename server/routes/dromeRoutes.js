import express from "express";
import * as dromeController from "../controllers/dromeController.js";

const router = express.Router();

router.post("/api/drome/chat", dromeController.processChat);

export default router;
