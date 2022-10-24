import * as React from "react"
import { Link } from "gatsby"

const Layout = ({ location, title, children }) => {
  const rootPath = `${__PATH_PREFIX__}/`
  const isRootPath = location.pathname === rootPath
  let header

  if (isRootPath) {
    header = (
      <h1 className="main-heading">
        <Link to="/">{title}</Link>
      </h1>
    )
  } else {
    header = (
      <Link className="header-link-home" to="/">
        {title}
      </Link>
    )
  }

  return (
    <div className="global-wrapper" data-is-root-path={isRootPath}>
      <header className="global-header">{header}</header>
      <main>{children}</main>
      <footer>
        © {new Date().getFullYear()}, Built with
        {` `}
        <a href="https://www.gatsbyjs.com">Gatsby</a>
        {` `}
        by <a href="https://linktr.ee/drpoindexter">David Poindexter,</a>
        {` `}
        open source on{" "}
        <a href="https://github.com/cleanslate-technology-group/indyaws-cdk-js-gatsby-blog">
          Github,
        </a>
        {` `}
        &amp; deployed on <a href="https://aws.amazon.com/cdk/">AWS via CDK</a>
      </footer>
    </div>
  )
}

export default Layout
