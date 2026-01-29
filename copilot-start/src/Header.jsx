import React from "react";

/**
 * Header component
 *
 * Displays the application header.
 *
 * @returns {JSX.Element} The Header component JSX
 */
function Header() {
  return (
    <header
      style={{
        backgroundColor: "#f8f9fa",
        padding: "1rem",
        textAlign: "center",
      }}
    >
      <h1>Welcome to My App</h1>
    </header>
  );
}

export default Header;
