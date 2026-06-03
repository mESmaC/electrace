// Renders a block's authored schematic SVG (with per-part <title> tooltips for hover-why).
export default function SchematicView({ svg }: { svg: string }) {
  return (
    <div
      className="schematic-svg grid h-full place-items-center overflow-auto p-8"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
