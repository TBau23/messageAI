import * as SQLite from 'expo-sqlite';

class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    console.log('Initializing SQLite database...');
    this.db = await SQLite.openDatabaseAsync('messageai.db');
    await this.createTables();
    console.log('✅ Database initialized');
  }

  async createTables() {
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        delivered_to TEXT,
        read_by TEXT,
        delivered_receipts TEXT,
        read_receipts TEXT,
        cached_at INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_messages_conversation 
      ON messages(conversation_id, timestamp DESC);
      
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT,
        participants TEXT NOT NULL,
        last_message TEXT,
        updated_at INTEGER NOT NULL,
        cached_at INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_conversations_updated 
      ON conversations(updated_at DESC);
      
      CREATE TABLE IF NOT EXISTS users (
        uid TEXT PRIMARY KEY,
        email TEXT,
        display_name TEXT,
        online INTEGER DEFAULT 0,
        last_seen INTEGER,
        cached_at INTEGER NOT NULL
      );
    `);
  }

  // Message operations
  async upsertMessage(message) {
    if (!this.db) {
      console.warn('Database not initialized');
      return;
    }

    try {
      // Validate required fields
      const conversationId = message.conversationId || message.conversation_id;
      const senderId = message.senderId || message.sender_id;
      
      if (!message.id) {
        console.warn('Skipping message cache: missing id');
        return;
      }
      
      if (!conversationId) {
        console.warn('Skipping message cache: missing conversationId', { messageId: message.id });
        return;
      }
      
      if (!senderId) {
        console.warn('Skipping message cache: missing senderId', { messageId: message.id });
        return;
      }
      
      if (!message.text) {
        console.warn('Skipping message cache: missing text', { messageId: message.id });
        return;
      }

      // Insert or replace - simple cache update
      await this.db.runAsync(
        `INSERT OR REPLACE INTO messages 
         (id, conversation_id, sender_id, text, timestamp, delivered_to, 
          read_by, delivered_receipts, read_receipts, cached_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          message.id,
          conversationId,
          senderId,
          message.text,
          typeof message.timestamp === 'number' ? message.timestamp : message.timestamp?.toMillis?.() || Date.now(),
          JSON.stringify(message.deliveredTo || message.delivered_to || []),
          JSON.stringify(message.readBy || message.read_by || []),
          JSON.stringify(message.deliveredReceipts || message.delivered_receipts || {}),
          JSON.stringify(message.readReceipts || message.read_receipts || {}),
          Date.now()
        ]
      );
    } catch (error) {
      console.error('Error upserting message to cache:', error, { messageId: message?.id });
    }
  }

  async getMessagesByConversation(conversationId) {
    if (!this.db) {
      console.warn('Database not initialized');
      return [];
    }

    try {
      const rows = await this.db.getAllAsync(
        'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC',
        [conversationId]
      );
      
      return rows.map(row => ({
        id: row.id,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        text: row.text,
        timestamp: new Date(row.timestamp),
        deliveredTo: JSON.parse(row.delivered_to || '[]'),
        readBy: JSON.parse(row.read_by || '[]'),
        deliveredReceipts: JSON.parse(row.delivered_receipts || '{}'),
        readReceipts: JSON.parse(row.read_receipts || '{}'),
      }));
    } catch (error) {
      console.error('Error getting messages from cache:', error);
      return [];
    }
  }
  
  // Conversation operations
  async upsertConversation(conversation) {
    if (!this.db) {
      console.warn('Database not initialized');
      return;
    }

    try {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO conversations 
         (id, type, name, participants, last_message, updated_at, cached_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          conversation.id,
          conversation.type,
          conversation.name || null,
          JSON.stringify(conversation.participants || []),
          JSON.stringify(conversation.lastMessage || conversation.last_message || null),
          typeof conversation.updatedAt === 'number' ? conversation.updatedAt : conversation.updatedAt?.toMillis?.() || Date.now(),
          Date.now()
        ]
      );
    } catch (error) {
      console.error('Error upserting conversation to cache:', error);
    }
  }

  async getConversations() {
    if (!this.db) {
      console.warn('Database not initialized');
      return [];
    }

    try {
      const rows = await this.db.getAllAsync(
        'SELECT * FROM conversations ORDER BY updated_at DESC'
      );
      
      return rows.map(row => ({
        id: row.id,
        type: row.type,
        name: row.name,
        participants: JSON.parse(row.participants),
        lastMessage: JSON.parse(row.last_message || 'null'),
        updatedAt: new Date(row.updated_at),
      }));
    } catch (error) {
      console.error('Error getting conversations from cache:', error);
      return [];
    }
  }
  
  // User cache operations
  async upsertUser(user) {
    if (!this.db) {
      console.warn('Database not initialized');
      return;
    }

    try {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO users 
         (uid, email, display_name, online, last_seen, cached_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          user.uid,
          user.email || null,
          user.displayName || user.display_name || null,
          user.online ? 1 : 0,
          typeof user.lastSeen === 'number' ? user.lastSeen : user.lastSeen?.toMillis?.() || null,
          Date.now()
        ]
      );
    } catch (error) {
      console.error('Error upserting user to cache:', error);
    }
  }

  async getUser(uid) {
    if (!this.db) {
      console.warn('Database not initialized');
      return null;
    }

    try {
      const row = await this.db.getFirstAsync(
        'SELECT * FROM users WHERE uid = ?',
        [uid]
      );
      
      if (!row) return null;
      
      return {
        uid: row.uid,
        email: row.email,
        displayName: row.display_name,
        online: row.online === 1,
        lastSeen: row.last_seen ? new Date(row.last_seen) : null,
      };
    } catch (error) {
      console.error('Error getting user from cache:', error);
      return null;
    }
  }
}

export const database = new Database();

