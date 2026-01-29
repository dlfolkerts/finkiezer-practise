import { Fragment } from "react";
import Header from "./Header";
import Footer from "./Footer";

/**
 * App component
 *
 * Renders the main application layout with a heading and test div.
 *
 * @returns {JSX.Element} The App component JSX
 */
function App() {
  return (
    <Fragment>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
        }}
      >
        <Header />
        <main style={{ flex: 1, padding: "1rem" }}>
          <h1>Hello World!</h1>
          <div>test</div>
        </main>
        <Footer />
      </div>
    </Fragment>
  );
}

export default App;
