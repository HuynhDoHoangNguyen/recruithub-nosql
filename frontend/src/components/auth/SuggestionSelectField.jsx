const OTHER_OPTION = '__other__';

const SuggestionSelectField = ({ id, name, label, value, onChange, options, placeholder, otherPlaceholder }) => {
  const isOther = value === OTHER_OPTION || value.startsWith(`${OTHER_OPTION}:`);
  const otherValue = isOther ? value.slice(OTHER_OPTION.length + 1) : '';

  const handleSelect = (event) => {
    onChange({ target: { name, value: event.target.value === OTHER_OPTION ? `${OTHER_OPTION}:` : event.target.value } });
  };

  const handleOtherChange = (event) => {
    onChange({ target: { name, value: `${OTHER_OPTION}:${event.target.value}` } });
  };

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="form-label whitespace-normal">{label}</label>
      <select id={id} name={name} value={isOther ? OTHER_OPTION : value} onChange={handleSelect} required className="input-field h-11 w-full min-w-0">
        <option value="" disabled>{placeholder}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
        <option value={OTHER_OPTION}>Khác — tự nhập</option>
      </select>
      {isOther && (
        <input
          type="text"
          value={otherValue}
          onChange={handleOtherChange}
          required
          maxLength={120}
          aria-label={`Nhập ${label.toLowerCase()} khác`}
          placeholder={otherPlaceholder}
          className="input-field mt-2.5 h-11"
        />
      )}
    </div>
  );
};

export default SuggestionSelectField;
