export function DataYamlPage({
  yamlText,
  setYamlText,
  yamlStatus,
  exportAllDataAsYaml,
  importAllDataFromYaml,
}) {
  return (
    <section className="panel">
      <h2>Data Import / Export (YAML)</h2>
      <p className="chart-summary">
        Export all saved entries as YAML or paste YAML here to restore data.
      </p>
      <div className="yaml-actions">
        <button type="button" onClick={exportAllDataAsYaml}>
          Export As YAML
        </button>
        <button type="button" onClick={importAllDataFromYaml}>
          Import From YAML
        </button>
      </div>
      <textarea
        className="yaml-editor"
        placeholder="YAML data will appear here after export. You can also paste YAML and import."
        value={yamlText}
        onChange={(event) => setYamlText(event.target.value)}
      />
      {yamlStatus ? <p className="chart-summary">{yamlStatus}</p> : null}
    </section>
  );
}
