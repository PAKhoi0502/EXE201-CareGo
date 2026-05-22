import { Link } from "react-router";

const styles = {
  primary: "bg-teal-700 text-white shadow-lg shadow-teal-700/20 hover:bg-teal-800",
  secondary: "border border-teal-200 bg-white text-teal-800 hover:border-teal-400 hover:bg-teal-50",
  light: "bg-white text-teal-800 hover:bg-teal-50",
};

const LandingButton = ({ to, href, variant = "primary", children, className = "" }) => {
  const classNames = `inline-flex min-h-12 items-center justify-center rounded-full px-5 text-sm font-extrabold transition hover:-translate-y-0.5 ${styles[variant]} ${className}`;

  if (to) {
    return (
      <Link to={to} className={classNames}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href || "#"} className={classNames}>
      {children}
    </a>
  );
};

export default LandingButton;
