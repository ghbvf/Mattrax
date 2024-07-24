import {
	Checkbox,
	Input,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@mattrax/ui";
import { createAsync } from "@solidjs/router";
import { createQuery } from "@tanstack/solid-query";
import { createWindowVirtualizer } from "@tanstack/solid-virtual";
import { For, Show, Suspense, createMemo, createSignal } from "solid-js";
import { db } from "~/lib/db";
import { FilterBar } from "./FilterBar";
import { entities } from "./configuration";
import type { Filter } from "./filters";

export function createSearchPageContext(defaultFilters: Filter[] = []) {
	// TODO: We should probs put some of this state into the URL???

	const [filters, setFilters] = createSignal<Filter[]>(defaultFilters);

	return { filters, setFilters, defaultFilters };
}

export function SearchPage(
	props: ReturnType<typeof createSearchPageContext> & {
		showFilterBar?: boolean;
	},
) {
	// TODO: Ordering
	// TODO: Result format (table or chart)

	// TODO: Make this reactive to DB changes!!!
	const query = createQuery(() => ({
		queryKey: ["search", props.filters()],
		// TODO: Filtering inside or outside Tanstack Query??? I can see merits both ways
		queryFn: async (ctx) => {
			let result: any[] = [];

			const d = await db;
			const activeFilters = ctx.queryKey[1] as Filter[];

			if (activeFilters.some((f) => f.type === "enum" && f.target === "type")) {
				for (const filter of activeFilters) {
					if (filter.type === "enum" && filter.target === "type") {
						switch (filter.value) {
							case "users":
								result = result.concat(await d.getAll("users"));
								break;
							case "devices":
								result = result.concat(await d.getAll("devices"));
								break;
							case "groups":
								result = result.concat(await d.getAll("groups"));
								break;
							case "policies":
								result = result.concat(await d.getAll("policies"));
								break;
							case "apps":
								result = result.concat(await d.getAll("apps"));
								break;
						}
					}
				}
			} else {
				result = result.concat(await d.getAll("users"));
				result = result.concat(await d.getAll("devices"));
				result = result.concat(await d.getAll("groups"));
				result = result.concat(await d.getAll("policies"));
				result = result.concat(await d.getAll("apps"));
			}

			const searchQuery = activeFilters.find(
				(f) => f.type === "string" && f.op === "eq",
			);
			if (searchQuery) {
				result = result.filter((r) => {
					for (const [key, value] of Object.entries(r)) {
						if (
							typeof value === "string" &&
							value.toLowerCase().includes(searchQuery.value.toLowerCase())
						) {
							return true;
						}
					}
					return false;
				});
			}

			return result;
		},
	}));

	return (
		<div class="p-4">
			{/* // TODO: Don't use `eq` op cause this should be full-text search */}
			<div class="relative">
				<div class="absolute top-0 bottom-0 pl-2 text-center">
					<div class="flex items-center justify-center h-full">
						<IconPhMagnifyingGlass />
					</div>
				</div>
				{/* // TODO: Debounce input a bit */}
				<Input
					placeholder="Search"
					class="mb-2 select-none pl-8"
					value={
						props.filters().find((f) => f.type === "string" && f.op === "eq")
							?.value ?? ""
					}
					onInput={(e) => {
						// TODO: Tack this on and update if we already have a search one????
						props.setFilters((filters) => [
							...(e.currentTarget.value === ""
								? []
								: ([
										{
											type: "string",
											op: "eq",
											// TODO: Search all fields but allow the user to refine it to a specific field???
											value: e.currentTarget.value,
										},
									] as const)),
							...filters.filter((f) => !(f.type === "string" && f.op === "eq")),
						]);
					}}
				/>
				<Show
					when={
						props
							.filters()
							.find((f) => f.type === "string" && f.op === "eq") !== undefined
					}
				>
					<button
						type="button"
						class="absolute top-0 bottom-0 right-0 pr-2 text-center"
						onClick={() =>
							props.setFilters((filters) =>
								filters.filter((f) => !(f.type === "string" && f.op === "eq")),
							)
						}
					>
						<div class="flex items-center justify-center h-full">
							<IconPhX />
						</div>
					</button>
				</Show>
			</div>
			<Show when={props.showFilterBar !== false}>
				<FilterBar {...props} />
			</Show>

			<Content {...props} />
		</div>
	);
}

function Content(props: ReturnType<typeof createSearchPageContext>) {
	// TODO: Optionally render results as chart or counter

	// const table = createStandardTable({
	// 	data: [],
	// 	columns: [],
	// });
	// createSearchParamFilter(table, "name", "search");

	// const dialog = createBulkDeleteDialog({
	// 	table,
	// 	onDelete: (data) => {
	// 		console.log(data);
	// 		alert("Do delete"); // TODO
	// 	},
	// });

	return (
		<Suspense
			fallback={
				<Show when>
					{() =>
						(
							// TODO: We don't want this. Theorically the table should suspend on a row level and can remove this barrier.
							// biome-ignore lint/style/noCommaOperator: <explanation>
							console.error("Table parent suspended!"), null
						)}
				</Show>
			}
		>
			<TableContent {...props} />

			{/* <FloatingSelectionBar table={table}>
				{(rows) => (
					<>
						<Button
									variant="destructive"
									size="sm"
									onClick={() => dialog.show(rows())}
								>
									Delete
								</Button>
					</>
				)}
			</FloatingSelectionBar> */}
			{/* <BulkDeleteDialog
				dialog={dialog}
				title={({ count }) => <>Delete {pluralize("User", count())}</>}
				description={({ count, rows }) => (
					<>
						Are you sure you want to delete{" "}
						<Switch>
							<Match when={count() > 1}>
								{count()} {pluralize("user", count())}
							</Match>
							<Match when={rows()[0]}>
								{(data) => (
									<div class="inline text-nowrap">
										<span class="text-black font-medium">
											{data().original.name}
										</span>
									</div>
								)}
							</Match>
						</Switch>
						?
					</>
				)}
			/> */}
		</Suspense>
	);
}

function TableContent(props: ReturnType<typeof createSearchPageContext>) {
	// TODO: Remove this
	const hasAnyItemFilter = () =>
		props.filters().some((f) => f.type === "enum" && f.target === "type");

	const rawData = createAsync(async () => {
		const result = (
			await Promise.all(
				Object.entries(entities).map(async ([key, def]) => {
					if (
						!hasAnyItemFilter() ||
						props
							.filters()
							.some(
								(f) =>
									f.type === "enum" && f.target === "type" && f.value === key,
							)
					) {
						return (await def.load()).map((data) => ({ type: key, data }));
					}

					return [];
				}),
			)
		).flat();

		console.log("RESULT2", result); // TODO
		return result;
	});

	// TODO: Really we wanna do ordering in IndexedDB so that we can only load active data the virtualiser requires????

	// TODO:
	// TODO: - Get config from UI/URL (maybe break out implementation to the `filters` object too)
	// TODO: - Sorting by multiple columns
	// TODO: - Sorting by multiple data types (Eg. String, number, boolean, enum)
	// TODO: - Handling of columns not on an entity
	const orderedData = createMemo(() => {
		const d = rawData();
		if (!d) return [];

		return d.sort((a, b) => a.data.name.localeCompare(b.data.name));
	});

	const virtualizer = createWindowVirtualizer({
		// TODO: Can we guess the number of rows and rely on `Suspense` on each row for a loading state???
		get count() {
			return orderedData()?.length ?? 0;
		},
		estimateSize: () => 52.5, // TODO
		overscan: 5,
	});

	// TODO: Allow the user to enable/disable columns
	const columns = createMemo(() => {
		// Get all of the possible columns given the active filters
		const columns = Object.entries(entities).flatMap(([key, info]) => {
			const isThisItemActive = props
				.filters()
				.some(
					(f) => f.type === "enum" && f.target === "type" && f.value === key,
				);
			if (hasAnyItemFilter() && !isThisItemActive) return [];
			// return info.columns();
			return Object.entries(info?.columns || {});
		});

		// Filter out duplicate columns by accessorKey
		// TODO: Ensure this picks the first one (for the header title)
		const filteredColumns = columns.filter(
			(a, index) => index === columns.findIndex((b) => a[0] === b[0]),
		);
		// const filteredColumns = columns; // TODO

		console.log("FILTERED COLS", filteredColumns); // TODO
		return filteredColumns;
	});

	// TODO: Bring back `selectCheckboxColumn`

	return (
		<>
			{/* // TODO: Replace "items" with the valid entities that can be returned??? */}
			<p class="text-sm py-2">Got {orderedData()?.length ?? 0} items</p>
			<Table>
				<TableHeader>
					{/* // TODO: We need to handle grouped columns by having multiple `TableRows`'s (for columns on 1-1 relations Eg. user name on device owner) */}
					<TableRow>
						<TableHead class="w-1">
							<Checkbox
								class="w-4"
								// TODO:
								// checked={table.getIsAllPageRowsSelected()}
								// indeterminate={table.getIsSomePageRowsSelected()}
								// onChange={(value) => table.toggleAllPageRowsSelected(!!value)}
								aria-label="Select all"
							/>
						</TableHead>

						<For each={columns()}>
							{([_, column]) => (
								<TableHead
								// style={{ width: `${header.getSize()}px` }}
								// draggable // TODO: DND reordering
								>
									{column.header}
								</TableHead>
							)}
						</For>
					</TableRow>
				</TableHeader>
				<TableBody
					style={{
						height: `${virtualizer.getTotalSize()}px`,
						width: "100%",
						position: "relative",
					}}
				>
					<For
						each={virtualizer.getVirtualItems()}
						fallback={
							<TableRow>
								<TableCell colSpan={columns().length} class="h-24 text-center">
									No results.
								</TableCell>
							</TableRow>
						}
					>
						{(virtualItem) => {
							const item = orderedData()[virtualItem.index]!;

							// TODO: Suspense at row level instead of table level

							return (
								<TableRow
									// {...props.rowProps?.(row)}
									class="flex"
									style={{
										// TODO: move to Tailwind
										position: "absolute",
										top: 0,
										left: 0,
										width: "100%",
										height: `${virtualItem.size}px`,
										transform: `translateY(${
											virtualItem.start - virtualizer.options.scrollMargin
										}px)`,
									}}
									// TODO: Active state
									// data-state={row.getIsSelected() && "selected"}
								>
									<TableCell>
										<Checkbox
											class="w-4"
											// TODO:
											// checked={row.getIsSelected()}
											// onChange={(value) => row.toggleSelected(!!value)}
											aria-label="Select row"
										/>
									</TableCell>

									<For each={columns()}>
										{([key, _]) => {
											return (
												<TableCell class="flex-1 overflow-hidden">
													<Show when={entities[item.type].columns[key]}>
														{(col) => col().render(item.data)}
													</Show>
												</TableCell>
											);
										}}
									</For>
								</TableRow>
							);
						}}
					</For>
				</TableBody>
			</Table>
		</>
	);
}
