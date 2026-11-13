import { useEffect, useRef, useState } from "react";
import { debounce } from "./utils.js";

function HighlightedName({ firstName, lastName, query }) {
  const fullName = `${firstName} ${lastName}`;
  const matchIndex = fullName.toLowerCase().indexOf(query.toLowerCase());

  if (matchIndex === -1) return fullName;

  return (
    <>
      {fullName.slice(0, matchIndex)}
      <strong>{fullName.slice(matchIndex, matchIndex + query.length)}</strong>
      {fullName.slice(matchIndex + query.length)}
    </>
  );
}

function App() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const cache = useRef(new Map());
  const normalizedQuery = query.trim();

  useEffect(() => {
    if (!normalizedQuery) {
      setUsers([]);
      setError("");
      setStatus("idle");
      return undefined;
    }

    const controller = new AbortController();
    let isCurrentSearch = true;
    setUsers([]);
    setError("");
    setStatus("loading");

    const searchAfterPause = debounce(async (term) => {
      const cacheKey = term.toLowerCase();
      const cachedUsers = cache.current.get(cacheKey);

      if (cachedUsers) {
        setUsers(cachedUsers);
        setStatus("success");
        return;
      }

      try {
        const response = await fetch(
          `https://dummyjson.com/users/search?q=${encodeURIComponent(term)}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error(`Search failed (${response.status}). Please try again.`);
        }

        const data = await response.json();
        if (!Array.isArray(data.users)) {
          throw new Error("The search response was not in the expected format.");
        }
        if (!isCurrentSearch) return;

        cache.current.set(cacheKey, data.users);
        setUsers(data.users);
        setStatus("success");
      } catch (requestError) {
        if (requestError?.name === "AbortError" || !isCurrentSearch) return;
        setError(requestError instanceof Error ? requestError.message : "Search failed.");
        setStatus("error");
      }
    }, 400);

    searchAfterPause(normalizedQuery);

    return () => {
      isCurrentSearch = false;
      searchAfterPause.cancel();
      controller.abort();
    };
  }, [normalizedQuery]);

  return (
    <main className="page">
      <header className="page-header">
        <h1>Debounced User Search</h1>
      </header>

      <label className="search-field">
        Search by name
        <input
          type="search"
          autoComplete="off"
          placeholder="Type a name"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <section className="results" aria-live="polite" aria-busy={status === "loading"}>
        {status === "idle" && <p>Type to search</p>}
        {status === "loading" && <p>Loading…</p>}
        {status === "error" && <p role="alert">Error: {error}</p>}
        {status === "success" && users.length === 0 && <p>No users found.</p>}
        {status === "success" && users.length > 0 && (
          <ul className="user-list">
            {users.map((user) => (
              <li key={user.id}>
                <h2>
                  <HighlightedName
                    firstName={user.firstName}
                    lastName={user.lastName}
                    query={normalizedQuery}
                  />
                </h2>
                <a href={`mailto:${user.email}`}>{user.email}</a>
                <p>{user.address?.city || "City unavailable"}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

export default App;
