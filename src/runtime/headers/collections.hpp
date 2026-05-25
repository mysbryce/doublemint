template <typename T>
class Queue {
  std::queue<T> data_;
public:
  void push(T value) { data_.push(value); }
  T pop() { if (data_.empty()) { throw std::runtime_error("Queue is empty"); } T value = data_.front(); data_.pop(); return value; }
  bool empty() const { return data_.empty(); }
  int size() const { return static_cast<int>(data_.size()); }
};

template <typename T>
class Set {
  std::unordered_set<T> data_;
public:
  void add(T value) { data_.insert(value); }
  bool has(T value) const { return data_.find(value) != data_.end(); }
  int size() const { return static_cast<int>(data_.size()); }
};

template <typename T>
class Stack {
  std::stack<T> data_;
public:
  void push(T value) { data_.push(value); }
  T pop() { if (data_.empty()) { throw std::runtime_error("Stack is empty"); } T value = data_.top(); data_.pop(); return value; }
  bool empty() const { return data_.empty(); }
  int size() const { return static_cast<int>(data_.size()); }
};
