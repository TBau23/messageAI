
Background
WhatsApp transformed how billions communicate by making messaging fast, reliable, and secure. The app works seamlessly across mobile platforms, handles offline scenarios gracefully, and delivers messages instantly even on poor network connections.
What's remarkable is that WhatsApp was originally built by just two developers—Brian Acton and Jan Koum—in a matter of months. They created an app that would eventually serve over 2 billion users worldwide. With today's AI coding tools, you can absolutely build a production-quality messaging app in one week—and potentially take it even further than they initially did.
This required solving complex technical challenges: message persistence, real-time delivery, optimistic UI updates, efficient data sync, and cross-platform compatibility.
Now imagine adding AI to this. What if your messaging app could automatically summarize long conversation threads? Or translate messages in real-time? Or provide an AI agent that helps you draft responses, schedule messages, or extract action items from group chats?
This project challenges you to build both a production-quality messaging infrastructure—like WhatsApp—and AI features that enhance the messaging experience using LLMs, agents, and RAG pipelines.
Why This Matters
The future of messaging isn't just about sending texts—it's about intelligent communication. You'll be building the foundation for how AI can make conversations more productive, accessible, and meaningful.
Project Overview
This is a one-week sprint with three key deadlines:
* MVP: Tuesday (24 hours)
* Early Submission: Friday (4 days)
* Final: Sunday (7 days)
You'll build in two phases: first the core messaging infrastructure with real-time sync and offline support, then AI features tailored to a specific user persona.
MVP Requirements (24 Hours)
This is a hard gate. To pass the MVP checkpoint, you must have:
* One-on-one chat functionality
* Real-time message delivery between 2+ users
* Message persistence (survives app restarts)
* Optimistic UI updates (messages appear instantly before server confirmation)
* Online/offline status indicators
* Message timestamps
* User authentication (users have accounts/profiles)
* Basic group chat functionality (3+ users in one conversation)
* Message read receipts
* Push notifications working (at least in foreground)
* Deployment: Running on local emulator/simulator with deployed backend (TestFlight/APK/Expo Go if possible, but not required for MVP)

THE ONLY THINGS REQUIRED FOR MVP ARE THE ONES LISTED ABOVE. EVERYTHING ELSE IS ADDITIONAL CONTEXT. SEE rubric.md for more details.

The MVP isn't about features—it's about proving your messaging infrastructure is solid. A simple chat app with reliable message delivery is worth more than a feature-rich app with messages that don't sync reliably.


Core Messaging Infrastructure
Essential Features
Your messaging app needs one-on-one chat with real-time message delivery. Messages must persist locally—users should see their chat history even when offline. Support text messages with timestamps and read receipts.
Implement online/offline presence indicators. Show when users are typing. Handle message delivery states: sending, sent, delivered, read.
Include basic media support—at minimum, users should be able to send and receive images. Add profile pictures and display names.
Build group chat functionality supporting 3+ users with proper message attribution and delivery tracking.
Real-Time Messaging
Every message should appear instantly for online recipients. When users go offline, messages queue and send when connectivity returns. The app must handle poor network conditions gracefully—3G, packet loss, intermittent connectivity.
Implement optimistic UI updates. When users send a message, it appears immediately in their chat, then updates with delivery confirmation. Messages never get lost—if the app crashes mid-send, the message should still go out.

Choose Your User Persona
You must build for ONE of these specific user types. Your AI features should be tailored to their needs.
For each persona, you must implement:
1. All 5 required AI features listed below
2. ONE advanced AI capability from the options provided


PERSONA CHOICE: International Communicator

Core Pain Points:
• Language barriers 
• Translation nuances 
• Copy-paste overhead 
• Learning difficulty


Required AI Features:
1. Real-time translation (inline) 
2. Language detection & auto-translate 
3. Cultural context hints 
4. Formality level adjustment 
5. Slang/idiom explanations

Advanced AI Features (Choose 1):
A) Context-Aware Smart Replies: Learns your style in multiple languages  
B) Intelligent Processing: Extracts structured data from multilingual conversations

AI Architecture Options:
Option 1: AI Chat Interface A dedicated AI assistant in a special chat where users can:
* Ask questions about their conversations
* Request actions ("Translate my last message to Spanish")
* Get proactive suggestions
Option 2: Contextual AI Features AI features embedded directly in conversations:
* Long-press message → translate/summarize/extract action
* Toolbar buttons for quick AI actions
* Inline suggestions as users type
Option 3: Hybrid Approach Both a dedicated AI assistant AND contextual features
AI Integration Requirements
The following agent frameworks are recommended:
* AI SDK by Vercel - streamlined agent development with tool calling
* OpenAI Agent SDK (Swarm) - lightweight multi-agent orchestration
* LangChain - comprehensive agent framework with extensive tools
Your agent should have:
* Conversation history retrieval (RAG pipeline)
* User preference storage
* Function calling capabilities
* Memory/state management across interactions
* Error handling and recovery
Technical Stack (Recommended)
The Golden Path: Firebase + Swift

React Native:
* Expo Router, Expo SQLite, Expo Notifications
* Deploy via Expo Go
* Still use Firebase backend

Build Strategy
Start with Messages First: Get basic messaging working end-to-end before anything else:
1. Send a text message from User A → appears on User B's device
2. Messages persist locally (works offline)
3. Messages sync on reconnect
4. Handle app lifecycle (background/foreground)
Only after messaging is solid should you add AI features.
Build Vertically: Finish one slice at a time. Don't have 10 half-working features.
Test on Real Hardware: Simulators don't accurately represent performance, networking, or app lifecycle. Use physical devices.
For AI Features:
* Start with simple prompts, iterate to improve accuracy
* Use RAG to give the LLM conversation context
* Test with edge cases (empty conversations, mixed languages, etc.)
* Cache common AI responses to reduce costs



