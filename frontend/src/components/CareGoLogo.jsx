const CareGoLogo = ({
  subtitle,
  className = "flex items-center gap-3 text-2xl font-black text-teal-800",
  imageClassName = "h-11 w-11",
  textClassName = "",
  subtitleClassName = "block text-xs font-bold text-teal-700/70",
}) => (
  <span className={className}>
    <img
      src="/Carego.jpg"
      alt="CareGo"
      className={`${imageClassName} shrink-0 rounded-2xl object-cover shadow-lg shadow-teal-700/15`}
    />
    <span className={textClassName}>
      <span className="block leading-5">CareGo</span>
      {subtitle ? <span className={subtitleClassName}>{subtitle}</span> : null}
    </span>
  </span>
);

export default CareGoLogo;
