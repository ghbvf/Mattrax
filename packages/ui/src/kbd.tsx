import clsx from "clsx";

export function Kbd(props: { class?: string; children: string }) {
	return (
		<kbd
			class={clsx(
				"pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100",
				props.class,
			)}
		>
			{props.children}
		</kbd>
	);
}
