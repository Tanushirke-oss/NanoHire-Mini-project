import { useEffect, useState } from "react";
import { getMessages, getConversation, sendMessage, getGig, getGigs, getUser, getUsers } from "../api";
import { useAuth } from "../context/AuthContext";
import { useParams } from "react-router-dom";
import { Link } from "react-router-dom";

export default function MessagesPage() {
  const { currentUser } = useAuth();
  const { gigId, otherUserId } = useParams();
  const [messages, setMessages] = useState([]);
  const [allMessages, setAllMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [gig, setGig] = useState(null);
  const [otherUser, setOtherUser] = useState(null);
  const [conversationsList, setConversationsList] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [usersMap, setUsersMap] = useState({});
  const [gigsMap, setGigsMap] = useState({});
  const [startableUsers, setStartableUsers] = useState([]);

  async function loadAllMessages() {
    try {
      const data = await getMessages();
      setAllMessages(data);

      const conversations = {};
      const userIds = new Set();
      const gigIds = new Set();

      for (const msg of data) {
        const peerId = msg.senderId === currentUser?.id ? msg.receiverId : msg.senderId;
        const key = `${msg.gigId}-${peerId}`;

        userIds.add(peerId);
        gigIds.add(msg.gigId);

        if (!conversations[key]) {
          conversations[key] = {
            gigId: msg.gigId,
            otherUserId: peerId,
            lastMessage: msg.content,
            lastMessageTime: msg.createdAt,
            unreadCount: 0,
            hasMessages: true
          };
        }
        if (!msg.isRead && msg.receiverId === currentUser?.id) {
          conversations[key].unreadCount++;
        }
      }

      const openable = await buildOpenableConversations();
      openable.forEach((item) => {
        const key = `${item.gigId}-${item.otherUserId}`;
        if (!conversations[key]) {
          conversations[key] = item;
        }
        userIds.add(item.otherUserId);
        gigIds.add(item.gigId);
      });

      await Promise.all(
        [...userIds].map(async (id) => {
          if (usersMap[id]) return;
          try {
            const user = await getUser(id);
            setUsersMap((prev) => ({ ...prev, [id]: user }));
          } catch (_error) {
            setUsersMap((prev) => ({ ...prev, [id]: null }));
          }
        })
      );

      await Promise.all(
        [...gigIds].map(async (id) => {
          if (gigsMap[id]) return;
          try {
            const oneGig = await getGig(id);
            setGigsMap((prev) => ({ ...prev, [id]: oneGig }));
          } catch (_error) {
            setGigsMap((prev) => ({ ...prev, [id]: null }));
          }
        })
      );

      setConversationsList(Object.values(conversations).sort((a, b) =>
        new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
      ));
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  }

  async function buildOpenableConversations() {
    if (!currentUser?.id) return [];

    try {
      const gigs = await getGigs();
      const results = [];

      gigs.forEach((gig) => {
        if (currentUser.role === "hirer" && gig.hirerId === currentUser.id) {
          const candidateIds = new Set((gig.applications || []).map((app) => app.studentId));
          if (gig.selectedStudentId) candidateIds.add(gig.selectedStudentId);

          candidateIds.forEach((studentId) => {
            results.push({
              gigId: gig.id,
              otherUserId: studentId,
              lastMessage: "Start a conversation",
              lastMessageTime: gig.updatedAt || gig.createdAt,
              unreadCount: 0,
              hasMessages: false
            });
          });
        }

        if (currentUser.role === "student") {
          const applied = (gig.applications || []).some((app) => app.studentId === currentUser.id);
          const selected = gig.selectedStudentId === currentUser.id;

          if (applied || selected) {
            results.push({
              gigId: gig.id,
              otherUserId: gig.hirerId,
              lastMessage: "Start a conversation",
              lastMessageTime: gig.updatedAt || gig.createdAt,
              unreadCount: 0,
              hasMessages: false
            });
          }
        }
      });

      return results;
    } catch (_error) {
      return [];
    }
  }

  async function loadConversation(gigId, otherUserId) {
    try {
      const data = await getConversation(gigId, otherUserId);
      setMessages(data);
      setSelectedConversation({ gigId, otherUserId });

      if (gigId !== "general") {
        const gigData = await getGig(gigId);
        setGig(gigData);
        setGigsMap((prev) => ({ ...prev, [gigId]: gigData }));
      } else {
        setGig(null);
      }
      
      const userData = await getUser(otherUserId);
      setOtherUser(userData);
      setUsersMap((prev) => ({ ...prev, [otherUserId]: userData }));
    } catch (err) {
      console.error("Failed to load conversation:", err);
    }
  }

  useEffect(() => {
    loadAllMessages();
  }, [currentUser?.id]);

  useEffect(() => {
    async function loadUsers() {
      if (!currentUser?.id) return;
      try {
        const users = await getUsers();
        setStartableUsers(users.filter((user) => user.id !== currentUser.id));
      } catch (_error) {
        setStartableUsers([]);
      }
    }

    loadUsers();
  }, [currentUser?.id]);

  useEffect(() => {
    if (gigId && otherUserId) {
      loadConversation(gigId, otherUserId);
    }
  }, [gigId, otherUserId]);

  async function openConversation(item) {
    setSelectedConversation({ gigId: item.gigId, otherUserId: item.otherUserId });

    if (item.hasMessages) {
      await loadConversation(item.gigId, item.otherUserId);
      return;
    }

    const userData = await getUser(item.otherUserId);
    if (item.gigId !== "general") {
      const gigData = await getGig(item.gigId);
      setGig(gigData);
      setGigsMap((prev) => ({ ...prev, [item.gigId]: gigData }));
    } else {
      setGig(null);
    }
    setOtherUser(userData);
    setMessages([]);
    setUsersMap((prev) => ({ ...prev, [item.otherUserId]: userData }));
  }

  async function startDirectConversation(user) {
    const item = {
      gigId: "general",
      otherUserId: user.id,
      lastMessage: "Start a conversation",
      lastMessageTime: new Date().toISOString(),
      unreadCount: 0,
      hasMessages: false
    };
    await openConversation(item);
  }

  async function handleSendMessage() {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      await sendMessage({
        gigId: selectedConversation.gigId,
        receiverId: selectedConversation.otherUserId,
        content: newMessage
      });
      setNewMessage("");
      loadConversation(selectedConversation.gigId, selectedConversation.otherUserId);
      loadAllMessages();
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  }

  if (!selectedConversation && gigId && otherUserId) {
    return (
      <section className="page messages-page">
        <div className="loading-state">Loading conversation...</div>
      </section>
    );
  }

  return (
    <section className="page messages-page">
      <div className="messages-container">
        {/* Conversations List */}
        <div className="conversations-sidebar">
          <h2>💬 Conversations</h2>
          <div className="start-chat-panel">
            <h3>Start New Chat</h3>
            <div className="start-chat-list">
              {startableUsers.slice(0, 8).map((user) => (
                <button
                  type="button"
                  key={user.id}
                  className="start-chat-btn"
                  onClick={() => startDirectConversation(user)}
                >
                  {user.name}
                </button>
              ))}
            </div>
          </div>
          <div className="conversations-list">
            {conversationsList.length === 0 ? (
              <div className="empty-state">No conversations yet</div>
            ) : (
              conversationsList.map((conv) => (
                <div
                  key={`${conv.gigId}-${conv.otherUserId}`}
                  className={`conversation-item ${
                    selectedConversation?.gigId === conv.gigId &&
                    selectedConversation?.otherUserId === conv.otherUserId
                      ? "active"
                      : ""
                  }`}
                  onClick={() => openConversation(conv)}
                >
                  <div className="conversation-preview">
                    <div className="conversation-title">
                      <Link to={`/profile/${conv.otherUserId}`} className="author-name">
                        {usersMap[conv.otherUserId]?.name || "User"}
                      </Link>
                      {conv.unreadCount > 0 && (
                        <span className="unread-badge">{conv.unreadCount}</span>
                      )}
                    </div>
                    <div className="conversation-gig-title">
                      {(gigsMap[conv.gigId]?.title || "Internship").slice(0, 48)}
                    </div>
                    <div className="conversation-last-msg">{conv.lastMessage}</div>
                    <div className="conversation-time">
                      {new Date(conv.lastMessageTime).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="chat-area">
          {selectedConversation ? (
            <>
              <div className="chat-header">
                <div className="chat-header-info">
                  {otherUser && (
                    <>
                      <img 
                        src={"https://ui-avatars.com/api/?name=" + otherUser.name + "&background=random"}
                        alt={otherUser.name}
                      />
                      <div>
                        <h3>
                          <Link to={`/profile/${otherUser.id}`} className="author-name">{otherUser.name}</Link>
                        </h3>
                        {gig && <p className="task-name">📋 {gig.title}</p>}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="messages-display">
                {messages.length === 0 ? (
                  <div className="empty-messages">
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`message ${
                        msg.senderId === currentUser?.id ? "sent" : "received"
                      }`}
                    >
                      <div className="message-content">
                        <p>{msg.content}</p>
                        <time>{new Date(msg.createdAt).toLocaleTimeString()}</time>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="message-input-area">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type your message here... (Shift+Enter for new line)"
                  className="message-input"
                />
                <button onClick={handleSendMessage} className="send-btn">
                  📤 Send
                </button>
              </div>
            </>
          ) : (
            <div className="no-conversation">
              <p>Select a conversation to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
