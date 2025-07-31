const PORT = process.env.PORT || 3000;
mongoose.connect("mongodb://localhost:27017/hms_db", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
