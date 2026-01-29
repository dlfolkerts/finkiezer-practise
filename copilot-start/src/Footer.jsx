import React from "react";

/**
 * Footer component
 *
 * Displays the application footer.
 *
 * @returns {JSX.Element} The Footer component JSX
 */
function Footer() {
  return (
    <footer
      style={{
        backgroundColor: "#f8f9fa",
        padding: "1rem",
        textAlign: "center",
        marginTop: "auto",
      }}
    >
      <p>&copy; 2026 My App. All rights reserved.</p>
    </footer>
  );
}

export default Footer;
