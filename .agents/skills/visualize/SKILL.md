---
name: visualize
description: Draw a small diagram or chart when a picture explains something faster than sentences - how a design or flow works, which pull requests depend on which, a before and after, options side by side, a number over time. Mermaid for how things connect, an SVG or HTML chart for numbers, shown to Jordi in the chat or in a pull request. Use for /visualize, or when ketchup, propose or a reply needs a picture.
---

# Visualize

One picture, small enough to read at a glance, drawn only from facts you
have.

## When a picture earns its place

Draw it when it is easier to grasp than sentences:

- how a design, a flow or a system works;
- pull requests and what each waits on or depends on;
- a before and after of a fix;
- two or three options side by side;
- numbers: a trend, a comparison, a before and after measurement.

Never draw a status list, a list of to-dos, or boxes with nothing
connecting them. A Markdown table is not a picture. Never give the same
fact twice, in the text and the picture.

## Draw it

- **How things connect: Mermaid** (`flowchart`, `sequenceDiagram`,
  `stateDiagram-v2`). At most six boxes, at most eight words in each,
  labels in words a person would say ("waits for Jordi", not
  "status: PENDING").
- **Numbers: a chart** as a self-contained SVG, or an HTML page with
  inline SVG and no external scripts. One message per chart: title it
  with what it shows, label the axes with units, start bars at zero, and
  mark the value that matters. Every number comes from a run, a query or
  a file you read; never invent or round one into a trend.
- **A screen: a screenshot**, taken on the local stack (`local-stack`,
  "Show a visual change"). Never draw or generate a picture of a screen
  you did not capture.

## Show it

- **In the chat:** write the file (`.mmd`, `.svg` or `.html`) in your
  scratchpad and send it with `SendUserFile`, `display: "render"`, with a
  one-line caption.
- **In a pull request or issue:** a fenced `mermaid` block in the body
  (GitHub draws it). A chart or screenshot goes in as an image only when
  it is committed or already hosted; otherwise describe the number in a
  sentence.

Link only artifacts that exist.
