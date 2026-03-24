import { useEffect, useMemo, useState } from "react";
import {
  commentOnPost,
  createPost,
  deletePost,
  getGigs,
  getMessages,
  getPosts,
  getUser,
  sharePost,
  togglePostLike,
} from "../api";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import TaskTimer from "../components/TaskTimer";
import MotivationalMessage from "../components/MotivationalMessage";
import { buildActivityNotifications } from "../utils/activityNotifications";

export default function HomePage() {
  const { currentUser, refreshSessionUser } = useAuth();
  const [posts, setPosts] = useState([]);
  const [content, setContent] = useState("");
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [mediaFile, setMediaFile] = useState(null);
  const [authorsMap, setAuthorsMap] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [posting, setPosting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [activityGigs, setActivityGigs] = useState([]);
  const [inboxMessages, setInboxMessages] = useState([]);

  async function loadPosts() {
    const data = await getPosts();
    setPosts(data);

    const ids = new Set();
    data.forEach((post) => {
      ids.add(post.authorId);
      (post.comments || []).forEach((comment) => ids.add(comment.userId));
    });

    const authors = {};
    await Promise.all(
      [...ids].map(async (id) => {
        try {
          const author = await getUser(id);
          authors[id] = author;
        } catch (_err) {
          authors[id] = null;
        }
      })
    );

    setAuthorsMap((prev) => ({ ...prev, ...authors }));
  }

  const fileHint = useMemo(() => {
    if (!mediaFile) return "No media selected";
    return `${mediaFile.name} (${Math.ceil(mediaFile.size / 1024)} KB)`;
  }, [mediaFile]);

  async function ensureAuthorLoaded(userId) {
    if (!userId || authorsMap[userId]) return;
    try {
      const user = await getUser(userId);
      setAuthorsMap((prev) => ({ ...prev, [userId]: user }));
    } catch (_error) {
      setAuthorsMap((prev) => ({ ...prev, [userId]: null }));
    }
  }

  function replacePost(updatedPost) {
    setPosts((prev) => prev.map((item) => (item.id === updatedPost.id ? updatedPost : item)));
  }

  async function handleLike(postId) {
    setActionError("");
    try {
      const updated = await togglePostLike(postId);
      replacePost(updated);
    } catch (_error) {
      setActionError("Could not like this post right now. Reloaded latest feed.");
      await loadPosts();
    }
  }

  async function handleShare(postId) {
    setActionError("");
    try {
      const updated = await sharePost(postId);
      replacePost(updated);
    } catch (_error) {
      setActionError("Could not share this post right now. Reloaded latest feed.");
      await loadPosts();
      return;
    }

    if (window?.location?.href && navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(window.location.href);
      } catch (_error) {
        // Clipboard support differs by browser/security settings.
      }
    }
  }

  useEffect(() => {
    loadPosts();
  }, []);

  useEffect(() => {
    async function loadSelectedTasks() {
      if (!currentUser?.id || currentUser.role !== "student") {
        setSelectedTasks([]);
        return;
      }

      const gigs = await getGigs();
      const mine = gigs
        .filter(
          (gig) =>
            gig.selectedStudentId === currentUser.id &&
            ["in_progress", "submitted"].includes(gig.status)
        )
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
      setSelectedTasks(mine);
    }

    loadSelectedTasks();
  }, [currentUser?.id, currentUser?.role]);

  useEffect(() => {
    async function loadActivitySignals() {
      if (!currentUser?.id) {
        setActivityGigs([]);
        setInboxMessages([]);
        return;
      }

      const [gigs, messages] = await Promise.all([getGigs(), getMessages()]);
      setActivityGigs(gigs);
      setInboxMessages(messages);
      await refreshSessionUser();
    }

    loadActivitySignals();
  }, [currentUser?.id, refreshSessionUser]);

  const notifications = useMemo(() => {
    return buildActivityNotifications({
      currentUser,
      gigs: activityGigs,
      messages: inboxMessages
    });
  }, [activityGigs, currentUser, inboxMessages]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!currentUser || !postTitle.trim()) {
      return;
    }

    setPosting(true);
    try {
      const formData = new FormData();
      formData.append("content", content);
      formData.append("title", postTitle);
      formData.append("body", postBody);
      if (mediaFile) formData.append("media", mediaFile);

      await createPost(formData);

      setContent("");
      setPostTitle("");
      setPostBody("");
      setMediaFile(null);
      await loadPosts();
    } finally {
      setPosting(false);
    }
  }

  async function handleDeletePost(postId) {
    if (!postId) return;

    const confirmed = window.confirm("Delete this post permanently?");
    if (!confirmed) return;

    setActionError("");
    try {
      await deletePost(postId);
      setPosts((prev) => prev.filter((post) => post.id !== postId));
    } catch (error) {
      setActionError(error?.response?.data?.message || "Could not delete post right now.");
    }
  }

  async function submitComment(postId) {
    const draft = (commentDrafts[postId] || "").trim();
    if (!draft) return;

    setActionError("");
    try {
      const updated = await commentOnPost(postId, { content: draft });
      replacePost(updated);
      setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
      await ensureAuthorLoaded(currentUser?.id);
      const newestComment = (updated.comments || [])[updated.comments.length - 1];
      if (newestComment?.userId) {
        await ensureAuthorLoaded(newestComment.userId);
      }
    } catch (_error) {
      setActionError("Could not add comment right now. Reloaded latest feed.");
      await loadPosts();
    }
  }

  function postIsLikedByMe(post) {
    return (post.likes || []).includes(currentUser?.id);
  }

  return (
    <section className="page page-home">
      <div className="feed-container">
        <div className="feed-sidebar hero">
          {notifications.length > 0 ? (
            <div className="panel activity-panel">
              <h3>Notifications</h3>
              <div className="activity-list">
                {notifications.map((item) => (
                  <Link key={item.id} to={item.link} className="activity-item-link">
                    <div className="activity-item">
                      <p>{item.text}</p>
                      <span>{new Date(item.createdAt).toLocaleString()}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {currentUser?.role === "hirer" ? (
            <>
              <h1>Hirer Command Center</h1>
              <p>
                Publish internships, select applicants, track progress, and release payment after quality delivery.
              </p>
            </>
          ) : (
            <>
              <h1>Student Mission Board</h1>
              <p>
                Apply for internships, share updates, and optionally post your own task as a hirer when you need help.
              </p>
              {selectedTasks.length > 0 ? (
                <div className="home-selected-task-list">
                  <h3>Your Active Task Timers</h3>
                  {selectedTasks.map((task) => (
                    <Link
                      to={`/marketplace/${task.id}`}
                      key={task.id}
                      className="home-selected-task-link"
                    >
                      <div className="home-selected-task-clock">
                        <TaskTimer deadline={task.deadline} />
                        <p>
                          Active task: <strong>{task.title}</strong>
                        </p>
                        <MotivationalMessage isSelected={true} />
                        <p className="search-meta">Open task details</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="feed-main">
          {/* Create Post Card */}
          <form className="post-composer" onSubmit={handleSubmit}>
            <div className="composer-header">
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || "User")}&background=random`}
                alt="avatar"
              />
              <div className="composer-fields">
                <input
                  type="text"
                  placeholder="Post title"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  className="composer-title"
                  required
                />
                <textarea
                  placeholder="Body of the post"
                  value={postBody}
                  onChange={(e) => setPostBody(e.target.value)}
                  className="composer-body"
                  rows={3}
                />
                <textarea
                  placeholder="Share opportunity updates, behind-the-scenes, or a call for collaboration"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <div className="composer-footer">
              <label className="composer-file-label" htmlFor="post-media-file">
                Choose image or video
              </label>
              <input
                id="post-media-file"
                type="file"
                className="composer-file-input"
                accept="image/*,video/mp4,video/webm,video/quicktime"
                onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
              />
              <span className="composer-file-meta">{fileHint}</span>
              <button type="submit" disabled={posting}>{posting ? "Publishing..." : "Publish"}</button>
            </div>
          </form>

          {/* Feed Posts */}
          <div className="feed-posts">
            {actionError ? <p className="error-text">{actionError}</p> : null}
            {posts.length === 0 ? (
              <div className="empty-feed">
                <p>No posts yet. Be the first to share!</p>
              </div>
            ) : (
              posts.map((post) => {
                const author = authorsMap[post.authorId];
                return (
                  <article key={post.id} className="feed-post">
                    <div className="post-header">
                      {author ? (
                        <>
                          <img 
                            src={"https://ui-avatars.com/api/?name=" + author.name + "&background=random"} 
                            alt={author.name}
                            className="author-avatar"
                          />
                          <div className="author-info">
                            <Link to={`/profile/${author.id}`} className="author-name">
                              {author.name}
                            </Link>
                            <span className="author-role">{author.role === "hirer" ? "Hirer" : "Student"}</span>
                            <time className="post-time">{new Date(post.createdAt).toLocaleString()}</time>
                          </div>
                        </>
                      ) : (
                        <div className="author-skeleton">Loading author...</div>
                      )}
                    </div>
                    <div className="post-content">
                      {post.title && <h3 className="post-title">{post.title}</h3>}
                      {post.body && <p className="post-body">{post.body}</p>}
                      {post.content ? <p className="post-text">{post.content}</p> : null}
                      {post.mediaUrl ? (
                        <div className="post-media-container">
                          {post.mediaType === "video" ? (
                            <video controls src={post.mediaUrl} className="post-media" />
                          ) : (
                            <img src={post.mediaUrl} alt="Post content" className="post-media" />
                          )}
                        </div>
                      ) : null}
                    </div>
                    <div className="post-actions">
                      <button
                        type="button"
                        className={postIsLikedByMe(post) ? "action-btn active" : "action-btn"}
                        onClick={() => handleLike(post.id)}
                      >
                        👍 Like ({post.likeCount ?? post.likes?.length ?? 0})
                      </button>
                      <button
                        type="button"
                        className="action-btn"
                        onClick={() => submitComment(post.id)}
                      >
                        💬 Comment ({post.commentCount ?? post.comments?.length ?? 0})
                      </button>
                      <button type="button" className="action-btn" onClick={() => handleShare(post.id)}>
                        📤 Share ({post.sharesCount || 0})
                      </button>
                      {post.authorId === currentUser?.id ? (
                        <button
                          type="button"
                          className="action-btn action-btn-danger"
                          onClick={() => handleDeletePost(post.id)}
                        >
                          🗑️ Delete Post
                        </button>
                      ) : null}
                    </div>

                    <div className="post-comments">
                      {(post.comments || []).map((comment) => {
                        const commentUser = authorsMap[comment.userId];
                        return (
                          <div key={`${comment.userId}-${comment.createdAt}`} className="comment-item">
                            <Link to={`/profile/${comment.userId}`} className="author-name">
                              {commentUser?.name || "User"}
                            </Link>
                            <span>{comment.content}</span>
                          </div>
                        );
                      })}

                      <div className="comment-composer">
                        <input
                          placeholder="Add a comment"
                          value={commentDrafts[post.id] || ""}
                          onChange={(e) =>
                            setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              submitComment(post.id);
                            }
                          }}
                        />
                        <button type="button" onClick={() => submitComment(post.id)}>
                          Send
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>

        <div className="feed-sidebar sidebar-right">
          <div className="sidebar-card">
            <h3>Quick Links</h3>
            <ul>
              {currentUser?.role === "hirer" ? (
                <>
                  <li><Link to="/marketplace">📋 Post Internship</Link></li>
                  <li><Link to="/tasks">👥 Manage Applicants</Link></li>
                  <li><Link to="/messages">💬 Messages</Link></li>
                </>
              ) : (
                <>
                  <li><Link to="/marketplace">🔍 Find Internships</Link></li>
                  <li><Link to="/tasks">📝 My Applications</Link></li>
                  <li><Link to="/messages">💬 Messages</Link></li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
