const express = require('express');

const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const vaultRoutes = require('./vault.routes');
const notesRoutes = require('./notes.routes');
const usersRoutes = require('./users.routes');
const requestsRoutes = require('./requests.routes');
const conversationsRoutes = require('./conversations.routes');

const router = express.Router();

router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/vault', vaultRoutes);
router.use('/notes', notesRoutes);
router.use('/users', usersRoutes);
router.use('/requests', requestsRoutes);
router.use('/conversations', conversationsRoutes);

module.exports = router;
