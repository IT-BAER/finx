const UserService = require("../services/userService");

// Get all users (admin only)
const getAllUsers = async (req, res) => {
  try {
    const users = await UserService.getAllUsers(req.user.id);
    res.json({ success: true, data: users });
  } catch (err) {
    handleError(res, err);
  }
};

// Create a new user (admin only)
const createUser = async (req, res) => {
  try {
    const user = await UserService.createUser(req.user.id, req.body);
    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        created_at: user.created_at,
        is_admin: !!user.is_admin,
      },
    });
  } catch (err) {
    handleError(res, err);
  }
};

// Update a user (admin only)
const updateUser = async (req, res) => {
  try {
    const updatedUser = await UserService.updateUser(
      req.user.id,
      req.params.id,
      req.body
    );
    res.json({ success: true, data: updatedUser });
  } catch (err) {
    handleError(res, err);
  }
};

// Delete a user (admin only)
const deleteUser = async (req, res) => {
  try {
    await UserService.deleteUser(req.user.id, req.params.id);
    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (err) {
    handleError(res, err);
  }
};

// Handle errors consistently
function handleError(res, err) {
  console.error("User controller error:", err.message);
  const statusMap = {
    "Access denied": 403,
    "User not found": 404,
    "User already exists": 400,
    "You cannot delete yourself": 400,
    "You cannot remove your own admin privileges": 400,
    "Cannot remove admin privileges": 400,
    "No updatable fields provided": 400,
  };
  
  const statusCode = statusMap[err.message] || 500;
  res.status(statusCode).json({ message: err.message });
}

module.exports = {
  getAllUsers,
  createUser,
  deleteUser,
  updateUser,
};
