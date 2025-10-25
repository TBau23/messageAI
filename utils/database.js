import * as SQLite from 'expo-sqlite';

class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    console.log('Initializing SQLite database...');
    this.db = await SQLite.openDatabaseAsync('messageai.db');
    await this.createTables();
    await this.migrateSchema();
    console.log('✅ Database initialized');
  }

  async migrateSchema() {
    try {
      // Migration: Add image fields to messages table (Phase 3)
      // Check if columns exist by trying to select them
      const testQuery = await this.db.getFirstAsync(
        'SELECT image_url FROM messages LIMIT 1'
      ).catch(() => null);

      if (testQuery === null) {
        console.log('🔄 Migrating database schema: Adding image support...');
        
        // Columns don't exist, add them
        await this.db.execAsync(`
          ALTER TABLE messages ADD COLUMN image_url TEXT;
          ALTER TABLE messages ADD COLUMN image_width INTEGER;
          ALTER TABLE messages ADD COLUMN image_height INTEGER;
        `);
        
        console.log('✅ Database migration complete: Image support added');
      }
    } catch (error) {
      console.warn('Database migration check failed (this is OK for new databases):', error.message);
    }
  }

  async createTables() {
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        text TEXT,
        timestamp INTEGER NOT NULL,
        delivered_to TEXT,
        read_by TEXT,
        delivered_receipts TEXT,
        read_receipts TEXT,
        image_url TEXT,
        image_width INTEGER,
        image_height INTEGER,
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
      
      // Message must have either text or image
      if (!message.text && !message.imageURL) {
        console.warn('Skipping message cache: missing both text and imageURL', { messageId: message.id });
        return;
      }

      // Insert or replace - simple cache update
      await this.db.runAsync(
        `INSERT OR REPLACE INTO messages 
         (id, conversation_id, sender_id, text, timestamp, delivered_to, 
          read_by, delivered_receipts, read_receipts, image_url, image_width, image_height, cached_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          message.id,
          conversationId,
          senderId,
          message.text || null,
          typeof message.timestamp === 'number' ? message.timestamp : message.timestamp?.toMillis?.() || Date.now(),
          JSON.stringify(message.deliveredTo || message.delivered_to || []),
          JSON.stringify(message.readBy || message.read_by || []),
          JSON.stringify(message.deliveredReceipts || message.delivered_receipts || {}),
          JSON.stringify(message.readReceipts || message.read_receipts || {}),
          message.imageURL || null,
          message.imageWidth || null,
          message.imageHeight || null,
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
      
      return rows.map(row => {
        const baseMessage = {
          id: row.id,
          conversationId: row.conversation_id,
          senderId: row.sender_id,
          timestamp: new Date(row.timestamp),
          deliveredTo: JSON.parse(row.delivered_to || '[]'),
          readBy: JSON.parse(row.read_by || '[]'),
          deliveredReceipts: JSON.parse(row.delivered_receipts || '{}'),
          readReceipts: JSON.parse(row.read_receipts || '{}'),
        };
        
        // Add text if exists
        if (row.text) {
          baseMessage.text = row.text;
        }
        
        // Add image data if exists
        if (row.image_url) {
          baseMessage.imageURL = row.image_url;
          baseMessage.imageWidth = row.image_width;
          baseMessage.imageHeight = row.image_height;
        }
        
        return baseMessage;
      });
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

  // Clear all cached data (useful for testing/debugging)
  async clearAllCache() {
    try {
      console.log('🗑️ Clearing all SQLite cache...');
      await this.db.execAsync(`
        DELETE FROM messages;
        DELETE FROM conversations;
        DELETE FROM users;
      `);
      console.log('✅ All cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
      throw error;
    }
  }

  // Drop all tables and recreate (nuclear option)
  async resetDatabase() {
    try {
      console.log('🗑️ Resetting database (dropping all tables)...');
      await this.db.execAsync(`
        DROP TABLE IF EXISTS messages;
        DROP TABLE IF EXISTS conversations;
        DROP TABLE IF EXISTS users;
      `);
      await this.createTables();
      console.log('✅ Database reset complete');
    } catch (error) {
      console.error('Error resetting database:', error);
      throw error;
    }
  }
}

export const database = new Database();

