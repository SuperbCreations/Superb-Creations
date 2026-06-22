type PolicySection = {
  title: string;
  body: string;
};

export function PolicyPage({
  eyebrow,
  title,
  updated,
  sections,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  sections: PolicySection[];
}) {
  return (
    <section className="container-boutique py-16 md:py-24">
      <div className="max-w-3xl">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl md:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: {updated}</p>
        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="font-display text-2xl">{section.title}</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
