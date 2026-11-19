export function ProgramCurriculumSection({
  modules,
}: {
  modules: { title: string; description: string }[];
}) {
  return (
    <ol className="program-curriculum">
      {modules.map((module, index) => (
        <li key={index}>
          <span className="program-module-index" aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </span>
          <div>
            <h3>{module.title}</h3>
            {module.description && <p>{module.description}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
