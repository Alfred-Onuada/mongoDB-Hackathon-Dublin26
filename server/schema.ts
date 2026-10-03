import mongoose from "mongoose";

const documentationChunkSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
      index: true
    },
    title: {
      
      type: String,
      required: true
    },
    source_url: {
      type: String,
      required: true
    },
    file_type: {
      type: String,
      default: 'pdf'
    },
    chunk_index: {
      type: Number,
      required: true
    },
    // The main text MongoDB Atlas Vectorize will auto-embed
    chunk_content: {
      type: String,
      required: true
    },
    embedding: {
      type: [Number],
      default: undefined,
      select: false // Exclude from standard queries to reduce network payload
    },
    metadata: {
      section: { type: String },
      page_number: { type: Number },
      associated_paths: [{ type: String, index: true }], // File paths linked to this doc
      tags: [{ type: String }]
    }
  },
  {
    timestamps: true,
  },
);

const Documentation = mongoose.model("Documentation", documentationChunkSchema);

export default Documentation;
